import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthStore } from '../../core/auth/auth-store';
import { HOSPITAL_UNIT_SCREENS } from '../../core/auth/screen-permissions';
import { DUPLICATE_BUSINESS_KEY, toApiError } from '../../core/http/api-error';
import {
  HospitalUnitDuplicateQuery,
  HospitalUnitRegistrationRequest,
  HospitalUnitResponse,
  HospitalUnitSummaryResponse,
} from '../../core/models/organization.models';
import { NotificationService } from '../../core/notifications/notification.service';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';
import { MaskDirective } from '../../shared/directives/mask.directive';
import {
  BRAZILIAN_STATES,
  isValidCep,
  isValidCnpj,
  stripCnpjMask,
} from '../../shared/format/brazilian-formats';
import {
  HospitalUnitControlKey,
  HospitalUnitFormValue,
  applyCepLookup,
  applyCnpjLookup,
  createHospitalUnitForm,
  mapServerFieldErrors,
  similarityFieldsChanged,
  toDuplicateQuery,
  toFormValue,
  toRegistrationRequest,
} from './hospital-unit-form.model';
import {
  HOSPITAL_UNIT_SECTIONS,
  HospitalUnitFieldDef,
  NATURE_OPTIONS,
  UNIT_TYPE_OPTIONS,
} from './hospital-unit-sections';
import { OrganizationCatalogService } from './organization-catalog.service';

const LIST_PATH = '/unidades-hospitalares';

/** Fields the backend always requires (`HospitalUnitRegistrationRequestValidator`). */
const ALWAYS_REQUIRED: ReadonlySet<HospitalUnitControlKey> = new Set<HospitalUnitControlKey>([
  'name',
  'postalCode',
  'street',
  'number',
  'district',
  'city',
  'state',
]);

export type LookupStatus = 'idle' | 'loading' | 'success' | 'notFound' | 'error';

export interface LookupState {
  readonly status: LookupStatus;
  readonly message: string | null;
}

const IDLE: LookupState = { status: 'idle', message: null };

export const CNPJ_UNAVAILABLE_MESSAGE =
  'Não foi possível consultar o CNPJ neste momento. Você pode continuar preenchendo os dados manualmente.';
export const CEP_UNAVAILABLE_MESSAGE =
  'Não foi possível consultar o CEP neste momento. Preencha o endereço manualmente.';
export const CEP_NOT_FOUND_MESSAGE = 'CEP não encontrado.';
export const INACTIVE_CNPJ_MESSAGE =
  'A situação cadastral deste CNPJ não está ativa. Revise os dados antes de continuar.';

/** Statuses of a lookup that mean "provider/API unavailable right now" — never a block. */
function isUnavailable(status: number): boolean {
  return status === 0 || status === 408 || status === 429 || status >= 500;
}

/**
 * Create/edit screen for a hospital unit (`/unidades-hospitalares/novo` and
 * `/unidades-hospitalares/:unitGuid/editar`), organised in the 10 sections of
 * issue #48. The PUT replaces the whole registration, so the edit flow loads
 * every stored value and always sends the complete request. CNPJ/CEP lookups are
 * explicit actions proxied by the backend and only *suggest* editable values;
 * the similarity check warns but never blocks.
 */
@Component({
  selector: 'app-hospital-unit-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ConfirmDialogComponent,
    StatusBadgeComponent,
    MaskDirective,
  ],
  templateUrl: './hospital-unit-form.component.html',
  styleUrl: './hospital-unit-form.component.scss',
})
export class HospitalUnitFormComponent implements OnInit {
  private readonly service = inject(OrganizationCatalogService);
  private readonly notifications = inject(NotificationService);
  private readonly store = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Route param `:unitGuid` (component input binding). Absent on `/novo`. */
  readonly unitGuid = input<string>();

  protected readonly sections = HOSPITAL_UNIT_SECTIONS;
  protected readonly unitTypeOptions = UNIT_TYPE_OPTIONS;
  protected readonly natureOptions = NATURE_OPTIONS;
  protected readonly states = BRAZILIAN_STATES;
  protected readonly inactiveCnpjMessage = INACTIVE_CNPJ_MESSAGE;
  protected readonly form = createHospitalUnitForm();

  protected readonly isEdit = computed(() => !!this.unitGuid());
  /** CNPJ/CEP lookups and the similarity check need the read permission. */
  protected readonly canLookup = computed(() => this.store.hasAll(HOSPITAL_UNIT_SCREENS.lookup));
  private readonly canView = computed(() => this.store.hasAll(HOSPITAL_UNIT_SCREENS.view));

  protected readonly loading = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly checkingDuplicates = signal(false);
  protected readonly busy = computed(() => this.saving() || this.checkingDuplicates());
  protected readonly formError = signal<string | null>(null);

  protected readonly loadedUnit = signal<HospitalUnitResponse | null>(null);
  protected readonly organizationName = computed(
    () => this.loadedUnit()?.organization.name ?? this.store.organizationName(),
  );

  protected readonly cnpjLookup = signal<LookupState>(IDLE);
  protected readonly cnpjInactiveWarning = signal(false);
  protected readonly cepLookup = signal<LookupState>(IDLE);

  private readonly cnpjValue = toSignal(this.form.controls.cnpj.valueChanges, {
    initialValue: this.form.controls.cnpj.value,
  });
  private readonly cepValue = toSignal(this.form.controls.postalCode.valueChanges, {
    initialValue: this.form.controls.postalCode.value,
  });
  protected readonly canQueryCnpj = computed(
    () => this.canLookup() && isValidCnpj(this.cnpjValue()) && this.cnpjLookup().status !== 'loading',
  );
  protected readonly canQueryCep = computed(
    () => this.canLookup() && isValidCep(this.cepValue()) && this.cepLookup().status !== 'loading',
  );

  /** Similar units returned by the check; non-null opens the confirmation. */
  protected readonly duplicateCandidates = signal<HospitalUnitSummaryResponse[] | null>(null);
  private pendingRequest: HospitalUnitRegistrationRequest | null = null;
  /** Raw form value of the last submit, to match late server errors to unchanged fields. */
  private submittedValue: HospitalUnitFormValue | null = null;
  private loadedSimilarity: HospitalUnitDuplicateQuery | null = null;

  private cnpjSubscription: Subscription | null = null;
  private cepSubscription: Subscription | null = null;

  protected readonly backLink = computed(() => {
    const guid = this.unitGuid();
    if (guid) {
      return [LIST_PATH, guid];
    }
    return this.canView() ? [LIST_PATH] : ['/inicio'];
  });

  ngOnInit(): void {
    const guid = this.unitGuid();
    if (!guid) {
      return;
    }
    this.loading.set(true);
    this.service
      .getHospitalUnit(guid)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (unit) => {
          this.loadedUnit.set(unit);
          this.form.reset(toFormValue(unit));
          this.loadedSimilarity = toDuplicateQuery(
            toRegistrationRequest(this.form.getRawValue()),
            guid,
          );
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.loading.set(false);
          const parsed = toApiError(err);
          this.loadError.set(
            parsed.status === 404
              ? 'A unidade hospitalar não foi encontrada ou não pertence à sua organização.'
              : parsed.message,
          );
        },
      });
  }

  // --- template helpers ------------------------------------------------

  protected controlId(key: string): string {
    return `hu-${key}`;
  }

  protected isRequired(key: HospitalUnitControlKey): boolean {
    if (ALWAYS_REQUIRED.has(key)) {
      return true;
    }
    if (key === 'cnpj') {
      return this.form.controls.hasOwnCnpj.value;
    }
    if (key === 'legalName') {
      return this.form.controls.cnpj.value.trim() !== '';
    }
    return false;
  }

  protected invalid(key: HospitalUnitControlKey): boolean {
    const control = this.form.controls[key];
    return control.invalid && (control.touched || control.dirty);
  }

  /** `aria-describedby`: hint, current error and (for lookups) the live status line. */
  protected describedBy(field: HospitalUnitFieldDef, extraId?: string): string | null {
    const ids: string[] = [];
    if (field.hint) ids.push(`${this.controlId(field.key)}-hint`);
    if (this.invalid(field.key)) ids.push(`${this.controlId(field.key)}-error`);
    if (extraId) ids.push(extraId);
    return ids.length > 0 ? ids.join(' ') : null;
  }

  protected errorFor(key: HospitalUnitControlKey): string {
    const errors = this.form.controls[key].errors ?? {};
    if (typeof errors['server'] === 'string') return errors['server'];
    if (typeof errors['duplicate'] === 'string') return errors['duplicate'];
    if (errors['required']) {
      if (key === 'cnpj') return 'Informe o CNPJ: a unidade foi marcada como tendo CNPJ próprio.';
      if (key === 'legalName') return 'Informe a razão social: ela é obrigatória quando há CNPJ.';
      return 'Campo obrigatório.';
    }
    if (errors['cnpjFormat']) return 'O CNPJ deve ter 14 dígitos.';
    if (errors['cnpjDigits']) return 'CNPJ inválido: os dígitos verificadores não conferem.';
    if (errors['cep']) return 'O CEP deve ter 8 dígitos.';
    if (errors['digits']) return `Informe exatamente ${errors['digits'].length} dígitos.`;
    if (errors['email']) return 'Informe um e-mail válido.';
    if (errors['phone']) return 'Informe um telefone válido (8 a 15 dígitos).';
    if (errors['url']) return 'Informe um endereço iniciando com http:// ou https://.';
    if (errors['integer']) return 'Informe um número inteiro.';
    if (errors['min']) return 'O valor não pode ser negativo.';
    if (errors['icuExceedsTotal']) return 'Os leitos de UTI não podem superar o total de leitos.';
    if (errors['maxlength']) return `Máximo de ${errors['maxlength'].requiredLength} caracteres.`;
    return 'Valor inválido.';
  }

  // --- CNPJ lookup -----------------------------------------------------

  /** Explicit action only — never fired while the user types. */
  protected consultCnpj(): void {
    if (!this.canQueryCnpj()) {
      return;
    }
    const digits = stripCnpjMask(this.form.controls.cnpj.value);
    this.cnpjSubscription?.unsubscribe();
    this.cnpjInactiveWarning.set(false);
    this.cnpjLookup.set({ status: 'loading', message: 'Consultando CNPJ…' });
    this.cnpjSubscription = this.service
      .lookupCnpj(digits)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          // The user changed the CNPJ while the lookup was running: discard it.
          if (this.form.controls.cnpj.value.replace(/\D/g, '') !== digits) {
            this.cnpjLookup.set(IDLE);
            return;
          }
          const { truncatedCnaes } = applyCnpjLookup(this.form, data);
          this.cnpjInactiveWarning.set(data.inactiveRegistrationWarning);
          this.cnpjLookup.set({
            status: 'success',
            message:
              'Dados preenchidos a partir da consulta. Revise e ajuste antes de salvar.' +
              (truncatedCnaes
                ? ' Alguns CNAEs secundários não couberam no limite de 2000 caracteres.'
                : ''),
          });
        },
        error: (err: unknown) => {
          const parsed = toApiError(err);
          if (parsed.status === 404) {
            this.cnpjLookup.set({
              status: 'notFound',
              message: 'CNPJ não encontrado na base consultada. Preencha os dados manualmente.',
            });
          } else if (parsed.status === 400) {
            this.cnpjLookup.set({ status: 'error', message: 'CNPJ inválido. Revise o número informado.' });
          } else if (isUnavailable(parsed.status)) {
            this.cnpjLookup.set({ status: 'error', message: CNPJ_UNAVAILABLE_MESSAGE });
          } else {
            this.cnpjLookup.set({ status: 'error', message: parsed.message });
          }
        },
      });
  }

  // --- CEP lookup ------------------------------------------------------

  protected consultCep(): void {
    if (!this.canQueryCep()) {
      return;
    }
    const digits = this.form.controls.postalCode.value.replace(/\D/g, '');
    this.cepSubscription?.unsubscribe();
    this.cepLookup.set({ status: 'loading', message: 'Consultando CEP…' });
    this.cepSubscription = this.service
      .lookupCep(digits)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          if (this.form.controls.postalCode.value.replace(/\D/g, '') !== digits) {
            this.cepLookup.set(IDLE);
            return;
          }
          applyCepLookup(this.form, data);
          this.cepLookup.set({
            status: 'success',
            message: 'Endereço preenchido a partir do CEP. Informe o número e revise os dados.',
          });
        },
        error: (err: unknown) => {
          const parsed = toApiError(err);
          if (parsed.status === 404) {
            this.cepLookup.set({
              status: 'notFound',
              message: `${CEP_NOT_FOUND_MESSAGE} Confira o número ou preencha o endereço manualmente.`,
            });
          } else if (parsed.status === 400) {
            this.cepLookup.set({ status: 'error', message: 'CEP inválido. Informe os 8 dígitos.' });
          } else if (isUnavailable(parsed.status)) {
            this.cepLookup.set({ status: 'error', message: CEP_UNAVAILABLE_MESSAGE });
          } else {
            this.cepLookup.set({ status: 'error', message: parsed.message });
          }
        },
      });
  }

  // --- submit ----------------------------------------------------------

  protected submit(): void {
    if (this.busy()) {
      return;
    }
    this.formError.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.formError.set('Revise os campos destacados antes de salvar.');
      this.focusFirstInvalid();
      return;
    }

    this.submittedValue = this.form.getRawValue();
    const request = toRegistrationRequest(this.submittedValue);
    const guid = this.unitGuid() ?? null;
    const query = toDuplicateQuery(request, guid);
    const relevant =
      !this.isEdit() || !this.loadedSimilarity || similarityFieldsChanged(this.loadedSimilarity, query);

    if (!this.canLookup() || !relevant) {
      this.save(request);
      return;
    }

    this.checkingDuplicates.set(true);
    this.service
      .findHospitalUnitDuplicates(query)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (candidates) => {
          this.checkingDuplicates.set(false);
          if (candidates.length > 0) {
            this.pendingRequest = request;
            this.duplicateCandidates.set(candidates);
          } else {
            this.save(request);
          }
        },
        // The check is only preventive: if it cannot run, saving proceeds.
        error: () => {
          this.checkingDuplicates.set(false);
          this.save(request);
        },
      });
  }

  protected confirmDespiteDuplicates(): void {
    const request = this.pendingRequest;
    this.duplicateCandidates.set(null);
    this.pendingRequest = null;
    if (request) {
      this.save(request);
    }
  }

  protected reviewDuplicates(): void {
    this.duplicateCandidates.set(null);
    this.pendingRequest = null;
  }

  protected candidateLocation(candidate: HospitalUnitSummaryResponse): string {
    return [candidate.city, candidate.state].filter((part) => !!part).join('/');
  }

  private save(request: HospitalUnitRegistrationRequest): void {
    if (this.saving()) {
      return;
    }
    const guid = this.unitGuid();
    this.saving.set(true);
    const request$ = guid
      ? this.service.updateHospitalUnit(guid, request)
      : this.service.createHospitalUnit(request);
    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (unit) => {
        this.saving.set(false);
        this.form.markAsPristine();
        this.notifications.success(
          guid ? 'Unidade hospitalar atualizada.' : 'Unidade hospitalar cadastrada.',
        );
        void this.router.navigate(this.canView() ? [LIST_PATH, unit.guid] : ['/inicio']);
      },
      error: (err: unknown) => this.fail(err),
    });
  }

  private fail(err: unknown): void {
    this.saving.set(false);
    const parsed = toApiError(err);

    if (parsed.status === 400 && parsed.fieldErrors) {
      const { mapped, unmapped } = mapServerFieldErrors(
        parsed.fieldErrors,
        Object.keys(this.form.controls),
      );
      for (const [key, message] of Object.entries(mapped) as [HospitalUnitControlKey, string][]) {
        if (!this.unchangedSinceSubmit(key)) {
          continue;
        }
        const control = this.form.controls[key];
        control.setErrors({ ...(control.errors ?? {}), server: message });
        control.markAsTouched();
      }
      const summary = ['Revise os campos destacados.', ...unmapped].join(' ');
      this.formError.set(summary);
      this.notifications.error(summary);
      this.focusFirstInvalid();
      return;
    }

    if (
      parsed.status === 409 &&
      parsed.code === DUPLICATE_BUSINESS_KEY &&
      (parsed.field === 'cnpj' || parsed.field === 'cnes' || parsed.field === 'internalCode')
    ) {
      if (this.unchangedSinceSubmit(parsed.field)) {
        const control = this.form.controls[parsed.field];
        control.setErrors({ ...(control.errors ?? {}), duplicate: parsed.message });
        control.markAsTouched();
      }
      this.formError.set(parsed.message);
      this.notifications.error(parsed.message);
      this.focusControl(parsed.field);
      return;
    }

    if (parsed.status === 404 && this.isEdit()) {
      this.notifications.warning(
        'A unidade hospitalar não foi encontrada ou não pertence mais à sua organização.',
      );
      void this.router.navigateByUrl(LIST_PATH);
      return;
    }

    this.formError.set(parsed.message);
    this.notifications.error(parsed.message);
  }

  /**
   * The form stays editable while saving, so a server error must only land on a
   * field that still holds the value that was sent — otherwise a late 400/409
   * would flag a value the user has already corrected.
   */
  private unchangedSinceSubmit(key: HospitalUnitControlKey): boolean {
    return this.submittedValue !== null && this.submittedValue[key] === this.form.controls[key].value;
  }

  private focusFirstInvalid(): void {
    for (const section of this.sections) {
      for (const field of section.fields) {
        if (this.form.controls[field.key].invalid) {
          this.focusControl(field.key);
          return;
        }
      }
    }
  }

  private focusControl(key: HospitalUnitControlKey): void {
    const element = this.host.nativeElement.querySelector<HTMLElement>(`#${this.controlId(key)}`);
    element?.focus();
  }
}
