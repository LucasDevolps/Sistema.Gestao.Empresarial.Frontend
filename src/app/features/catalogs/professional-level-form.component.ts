import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { DUPLICATE_BUSINESS_KEY, describeFieldErrors, toApiError } from '../../core/http/api-error';
import {
  PROFESSIONAL_LEVEL_LIMITS,
  UpsertProfessionalLevelRequest,
} from '../../core/models/catalog.models';
import { NotificationService } from '../../core/notifications/notification.service';
import { ProfessionalCatalogService } from './professional-catalog.service';

const LIST_PATH = '/niveis-profissionais';

type LevelField = 'code' | 'name' | 'order';

/** Rejects blank-only text: `Validators.required` accepts "   ". */
function notBlank(control: AbstractControl<string>): ValidationErrors | null {
  return control.value.trim().length === 0 ? { required: true } : null;
}

function integer(control: AbstractControl<number | null>): ValidationErrors | null {
  return control.value === null || Number.isInteger(control.value) ? null : { integer: true };
}

/**
 * Create/edit screen for a professional level. Client-side validation mirrors the
 * backend limits for UX only — the API re-validates everything and owns the
 * uniqueness rule (a 409 `DUPLICATE_BUSINESS_KEY` is mapped back to the field).
 */
@Component({
  selector: 'app-professional-level-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="page stack">
      <header class="page__head">
        <div>
          <h1 class="page__title">{{ isEdit() ? 'Editar nível profissional' : 'Novo nível profissional' }}</h1>
          <p class="page__subtitle">
            O código identifica o nível de forma curta (ex.: JR, PL, SR, ESP) e é salvo em maiúsculas.
            A ordem define a posição do nível nas listagens.
          </p>
        </div>
      </header>

      @if (loading()) {
        <div class="empty-state"><span class="spinner"></span> Carregando…</div>
      } @else if (loadError()) {
        <div class="card">
          <div class="card__body stack">
            <p role="alert">{{ loadError() }}</p>
            <a class="btn btn--ghost" [routerLink]="listPath">Voltar para a lista</a>
          </div>
        </div>
      } @else {
        <form class="card" [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <div class="card__body stack">
            <div class="grid-2">
              <div class="field">
                <label class="field__label" for="code">Código</label>
                <input
                  id="code"
                  class="input"
                  formControlName="code"
                  autocomplete="off"
                  [maxlength]="limits.codeMaxLength"
                  [attr.aria-invalid]="invalid('code')"
                  [attr.aria-describedby]="invalid('code') ? 'code-error' : null"
                  style="text-transform: uppercase"
                />
                @if (invalid('code')) {
                  <span id="code-error" class="field__error">{{ errorFor('code') }}</span>
                }
              </div>
              <div class="field">
                <label class="field__label" for="order">Ordem</label>
                <input
                  id="order"
                  class="input"
                  type="number"
                  inputmode="numeric"
                  formControlName="order"
                  [min]="limits.orderMin"
                  [max]="limits.orderMax"
                  step="1"
                  [attr.aria-invalid]="invalid('order')"
                  [attr.aria-describedby]="invalid('order') ? 'order-error' : null"
                />
                @if (invalid('order')) {
                  <span id="order-error" class="field__error">{{ errorFor('order') }}</span>
                }
              </div>
            </div>
            <div class="field">
              <label class="field__label" for="name">Nome</label>
              <input
                id="name"
                class="input"
                formControlName="name"
                autocomplete="off"
                [maxlength]="limits.nameMaxLength"
                [attr.aria-invalid]="invalid('name')"
                [attr.aria-describedby]="invalid('name') ? 'name-error' : null"
              />
              @if (invalid('name')) {
                <span id="name-error" class="field__error">{{ errorFor('name') }}</span>
              }
            </div>
          </div>
          <div
            class="card__header"
            style="border-top: 1px solid var(--color-border); border-bottom: none"
          >
            <a class="btn btn--ghost" [routerLink]="listPath">Cancelar</a>
            <button type="submit" class="btn btn--accent" [disabled]="busy()">
              @if (busy()) {
                <span class="spinner" aria-hidden="true"></span> Salvando…
              } @else {
                {{ isEdit() ? 'Salvar' : 'Cadastrar' }}
              }
            </button>
          </div>
        </form>
      }
    </div>
  `,
})
export class ProfessionalLevelFormComponent implements OnInit {
  private readonly service = inject(ProfessionalCatalogService);
  private readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);

  /** Route param `:guid` (component input binding). Absent on `/novo`. */
  readonly guid = input<string>();

  protected readonly listPath = LIST_PATH;
  protected readonly limits = PROFESSIONAL_LEVEL_LIMITS;
  protected readonly isEdit = computed(() => !!this.guid());

  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly loadError = signal<string | null>(null);

  protected readonly form = new FormGroup({
    code: new FormControl('', {
      nonNullable: true,
      validators: [notBlank, Validators.maxLength(PROFESSIONAL_LEVEL_LIMITS.codeMaxLength)],
    }),
    name: new FormControl('', {
      nonNullable: true,
      validators: [notBlank, Validators.maxLength(PROFESSIONAL_LEVEL_LIMITS.nameMaxLength)],
    }),
    order: new FormControl<number | null>(null, {
      validators: [
        Validators.required,
        Validators.min(PROFESSIONAL_LEVEL_LIMITS.orderMin),
        Validators.max(PROFESSIONAL_LEVEL_LIMITS.orderMax),
        integer,
      ],
    }),
  });

  ngOnInit(): void {
    const guid = this.guid();
    if (!guid) {
      this.loading.set(false);
      return;
    }
    this.service.getLevel(guid).subscribe({
      next: (level) => {
        this.form.setValue({ code: level.code, name: level.name, order: level.order });
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        const parsed = toApiError(err);
        this.loadError.set(
          parsed.status === 404
            ? 'O nível profissional não foi encontrado ou foi excluído.'
            : parsed.message,
        );
      },
    });
  }

  protected invalid(field: LevelField): boolean {
    const control = this.form.controls[field];
    return control.invalid && (control.touched || control.dirty);
  }

  protected errorFor(field: LevelField): string {
    const errors = this.form.controls[field].errors ?? {};
    if (errors['duplicate']) {
      return field === 'code'
        ? 'Já existe um nível profissional com este código.'
        : 'Já existe um nível profissional com este nome.';
    }
    switch (field) {
      case 'code':
        return `Informe o código (até ${PROFESSIONAL_LEVEL_LIMITS.codeMaxLength} caracteres).`;
      case 'name':
        return `Informe o nome (até ${PROFESSIONAL_LEVEL_LIMITS.nameMaxLength} caracteres).`;
      default:
        return `Informe um número inteiro entre ${PROFESSIONAL_LEVEL_LIMITS.orderMin} e ${PROFESSIONAL_LEVEL_LIMITS.orderMax}.`;
    }
  }

  protected submit(): void {
    if (this.busy()) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.getRawValue();
    const body: UpsertProfessionalLevelRequest = {
      code: raw.code.trim().toUpperCase(),
      name: raw.name.trim(),
      order: raw.order as number,
    };
    const guid = this.guid();
    this.busy.set(true);

    const request$ = guid ? this.service.updateLevel(guid, body) : this.service.createLevel(body);
    request$.subscribe({
      next: () => {
        this.busy.set(false);
        this.notifications.success(guid ? 'Nível profissional atualizado.' : 'Nível profissional cadastrado.');
        void this.router.navigateByUrl(LIST_PATH);
      },
      error: (err: unknown) => this.fail(err),
    });
  }

  private fail(err: unknown): void {
    this.busy.set(false);
    const parsed = toApiError(err);
    if (parsed.code === DUPLICATE_BUSINESS_KEY && (parsed.field === 'code' || parsed.field === 'name')) {
      const control = this.form.controls[parsed.field];
      control.setErrors({ ...(control.errors ?? {}), duplicate: true });
      control.markAsTouched();
      this.notifications.error(this.errorFor(parsed.field));
      return;
    }
    if (parsed.status === 404) {
      this.notifications.warning('O nível profissional não existe mais.');
      void this.router.navigateByUrl(LIST_PATH);
      return;
    }
    this.notifications.error(describeFieldErrors(parsed.fieldErrors) ?? parsed.message);
  }
}
