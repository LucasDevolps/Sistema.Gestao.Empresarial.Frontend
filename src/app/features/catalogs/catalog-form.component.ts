import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthStore } from '../../core/auth/auth-store';
import { describeFieldErrors, toApiError } from '../../core/http/api-error';
import { UpsertCatalogRequest } from '../../core/models/catalog.models';
import { NotificationService } from '../../core/notifications/notification.service';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';
import { CATALOG_KINDS, CatalogKind } from './catalog-kind';
import { ProfessionalCatalogService } from './professional-catalog.service';

@Component({
  selector: 'app-catalog-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, StatusBadgeComponent],
  template: `
    <div class="page stack">
      <header class="page__head">
        <div>
          <h1 class="page__title">
            {{ isEdit() ? 'Editar ' : 'Nova ' }}{{ config().titleSingular.toLowerCase() }}
          </h1>
        </div>
      </header>

      @if (loading()) {
        <div class="empty-state"><span class="spinner"></span> Carregando…</div>
      } @else if (loadError()) {
        <div class="card"><div class="card__body"><p role="alert">{{ loadError() }}</p></div></div>
      } @else {
        <form class="card" [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <div class="card__body stack">
            @if (isEdit()) {
              <div class="row" style="align-items: center; gap: 0.75rem">
                <span class="muted">Situação atual:</span>
                <app-status-badge [active]="active()" />
                <button
                  type="button"
                  class="btn btn--ghost btn--sm"
                  [disabled]="!canEdit() || busy()"
                  (click)="toggleStatus()"
                >
                  {{ active() ? 'Inativar' : 'Reativar' }}
                </button>
              </div>
            }
            <div class="field">
              <label class="field__label" for="name">Nome</label>
              <input id="name" class="input" formControlName="name" maxlength="150" />
              @if (invalid('name')) {
                <span class="field__error">Informe o nome (até 150 caracteres).</span>
              }
            </div>
            <div class="field">
              <label class="field__label" for="description">
                Descrição <span class="field__hint">(opcional, até 500)</span>
              </label>
              <textarea id="description" class="textarea" rows="3" formControlName="description" maxlength="500"></textarea>
            </div>
          </div>
          <div class="card__header" style="border-top: 1px solid var(--color-border); border-bottom: none">
            <a class="btn btn--ghost" [routerLink]="config().listPath">Cancelar</a>
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
export class CatalogFormComponent implements OnInit {
  private readonly service = inject(ProfessionalCatalogService);
  private readonly notifications = inject(NotificationService);
  private readonly store = inject(AuthStore);
  private readonly router = inject(Router);

  readonly kind = input.required<CatalogKind>();
  readonly guid = input<string>();

  protected readonly config = computed(() => CATALOG_KINDS[this.kind()]);
  protected readonly isEdit = computed(() => !!this.guid());
  protected readonly canEdit = computed(() => this.store.hasPermission(this.config().edit));

  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly active = signal(true);

  protected readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(150)] }),
    description: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
  });

  ngOnInit(): void {
    if (!this.isEdit()) {
      this.loading.set(false);
      return;
    }
    const load$ =
      this.kind() === 'profession'
        ? this.service.getProfession(this.guid()!)
        : this.service.getPosition(this.guid()!);
    load$.subscribe({
      next: (row) => {
        this.form.patchValue({ name: row.name, description: row.description ?? '' });
        this.active.set(row.active);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.loadError.set(toApiError(err).message);
      },
    });
  }

  protected invalid(control: 'name'): boolean {
    const ctrl = this.form.controls[control];
    return ctrl.invalid && (ctrl.touched || ctrl.dirty);
  }

  protected toggleStatus(): void {
    if (!this.isEdit() || this.busy()) {
      return;
    }
    this.busy.set(true);
    const next = !this.active();
    const request$ =
      this.kind() === 'profession'
        ? this.service.changeProfessionStatus(this.guid()!, { active: next })
        : this.service.changePositionStatus(this.guid()!, { active: next });
    request$.subscribe({
      next: (row) => {
        this.active.set(row.active);
        this.busy.set(false);
        this.notifications.success(row.active ? 'Registro reativado.' : 'Registro inativado.');
      },
      error: (err: unknown) => this.fail(err),
    });
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
    const body: UpsertCatalogRequest = {
      name: raw.name.trim(),
      description: raw.description.trim() || null,
    };
    this.busy.set(true);

    const request$ = this.isEdit()
      ? this.kind() === 'profession'
        ? this.service.updateProfession(this.guid()!, body)
        : this.service.updatePosition(this.guid()!, body)
      : this.kind() === 'profession'
        ? this.service.createProfession(body)
        : this.service.createPosition(body);

    request$.subscribe({
      next: () => {
        this.busy.set(false);
        this.notifications.success(this.isEdit() ? 'Registro atualizado.' : 'Registro cadastrado.');
        void this.router.navigateByUrl(this.config().listPath);
      },
      error: (err: unknown) => this.fail(err),
    });
  }

  private fail(err: unknown): void {
    this.busy.set(false);
    const parsed = toApiError(err);
    this.notifications.error(describeFieldErrors(parsed.fieldErrors) ?? parsed.message);
  }
}
