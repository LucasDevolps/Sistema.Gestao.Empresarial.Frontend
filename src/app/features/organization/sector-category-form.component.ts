import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthStore } from '../../core/auth/auth-store';
import { describeFieldErrors, toApiError } from '../../core/http/api-error';
import { UpsertSectorCategoryRequest } from '../../core/models/organization.models';
import { NotificationService } from '../../core/notifications/notification.service';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';
import { OrganizationCatalogService } from './organization-catalog.service';

@Component({
  selector: 'app-sector-category-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, StatusBadgeComponent],
  template: `
    <div class="page stack">
      <header class="page__head">
        <div>
          <h1 class="page__title">{{ isEdit() ? 'Editar categoria' : 'Nova categoria' }} de setor</h1>
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
              <input id="name" class="input" formControlName="name" maxlength="120" />
              @if (invalid('name')) {
                <span class="field__error">Informe o nome (até 120 caracteres).</span>
              }
            </div>
            <div class="field">
              <label class="field__label" for="description">
                Descrição <span class="field__hint">(opcional, até 500)</span>
              </label>
              <textarea
                id="description"
                class="textarea"
                rows="3"
                formControlName="description"
                maxlength="500"
              ></textarea>
            </div>
          </div>
          <div
            class="card__header"
            style="border-top: 1px solid var(--color-border); border-bottom: none"
          >
            <a class="btn btn--ghost" routerLink="/categorias-setor">Cancelar</a>
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
export class SectorCategoryFormComponent implements OnInit {
  private readonly service = inject(OrganizationCatalogService);
  private readonly notifications = inject(NotificationService);
  private readonly store = inject(AuthStore);
  private readonly router = inject(Router);

  readonly categoryGuid = input<string>();

  protected readonly isEdit = computed(() => !!this.categoryGuid());
  protected readonly canEdit = computed(() => this.store.hasPermission('CATEGORIA_SETOR_EDITAR'));

  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly active = signal(true);

  protected readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(120)],
    }),
    description: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
  });

  ngOnInit(): void {
    if (!this.isEdit()) {
      this.loading.set(false);
      return;
    }
    this.service.getSectorCategory(this.categoryGuid()!).subscribe({
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
    this.service
      .changeSectorCategoryStatus(this.categoryGuid()!, { active: !this.active() })
      .subscribe({
        next: (row) => {
          this.active.set(row.active);
          this.busy.set(false);
          this.notifications.success(row.active ? 'Categoria reativada.' : 'Categoria inativada.');
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
    const body: UpsertSectorCategoryRequest = {
      name: raw.name.trim(),
      description: raw.description.trim() || null,
    };
    this.busy.set(true);

    const request$ = this.isEdit()
      ? this.service.updateSectorCategory(this.categoryGuid()!, body)
      : this.service.createSectorCategory(body);

    request$.subscribe({
      next: () => {
        this.busy.set(false);
        this.notifications.success(this.isEdit() ? 'Categoria atualizada.' : 'Categoria cadastrada.');
        void this.router.navigateByUrl('/categorias-setor');
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
