import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { AuthStore } from '../../core/auth/auth-store';
import { HOSPITAL_UNIT_SCREENS } from '../../core/auth/screen-permissions';
import { toApiError } from '../../core/http/api-error';
import { HospitalUnitResponse } from '../../core/models/organization.models';
import { NotificationService } from '../../core/notifications/notification.service';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';
import { HasPermissionDirective } from '../../shared/directives/has-permission.directive';
import {
  HOSPITAL_UNIT_SECTIONS,
  INACTIVATE_UNIT_MESSAGE,
  displayValue,
} from './hospital-unit-sections';
import { OrganizationCatalogService } from './organization-catalog.service';

interface DetailRow {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly multiline: boolean;
}

interface DetailSection {
  readonly id: string;
  readonly title: string;
  readonly rows: readonly DetailRow[];
}

/**
 * Read-only view of the complete registration, grouped in the same sections as
 * the form. Empty fields (and sections with nothing filled) are skipped instead
 * of printing a dash for every unknown value.
 */
@Component({
  selector: 'app-hospital-unit-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    DatePipe,
    StatusBadgeComponent,
    HasPermissionDirective,
    ConfirmDialogComponent,
  ],
  template: `
    <div class="page stack">
      @if (loading()) {
        <div class="empty-state" role="status">
          <span class="spinner" aria-hidden="true"></span> Carregando…
        </div>
      } @else if (error()) {
        <div class="card">
          <div class="card__body stack">
            <p role="alert">{{ error() }}</p>
            <a class="btn btn--ghost" routerLink="/unidades-hospitalares">Voltar</a>
          </div>
        </div>
      } @else if (unit(); as u) {
        <header class="page__head">
          <div>
            <h1 class="page__title">{{ u.name }}</h1>
            <p class="page__subtitle">
              @if (u.legalName) {
                {{ u.legalName }} ·
              }
              {{ u.organization.name }} ·
              <app-status-badge [active]="u.active" activeLabel="Ativa" inactiveLabel="Inativa" />
            </p>
          </div>
          <div class="row" style="align-items: center; gap: 0.5rem">
            <a
              *appHasPermission="screens.edit"
              class="btn btn--ghost"
              [routerLink]="['/unidades-hospitalares', u.guid, 'editar']"
            >
              Editar
            </a>
            <button
              *appHasPermission="screens.status"
              type="button"
              class="btn"
              [class.btn--danger]="u.active"
              [disabled]="busy()"
              (click)="requestStatusChange()"
            >
              @if (busy()) {
                <span class="spinner" aria-hidden="true"></span> Processando…
              } @else {
                {{ u.active ? 'Inativar unidade' : 'Reativar unidade' }}
              }
            </button>
            <a class="btn btn--ghost" routerLink="/unidades-hospitalares">Voltar</a>
          </div>
        </header>

        @for (section of sections(); track section.id) {
          <section class="card" [attr.aria-labelledby]="'hu-detail-' + section.id">
            <div class="card__header">
              <h2 class="hu-detail__title" [id]="'hu-detail-' + section.id">{{ section.title }}</h2>
            </div>
            <div class="card__body">
              <dl class="facts">
                @for (row of section.rows; track row.key) {
                  <div>
                    <dt>{{ row.label }}</dt>
                    <dd [class.hu-detail__multiline]="row.multiline">{{ row.value }}</dd>
                  </div>
                }
              </dl>
            </div>
          </section>
        }

        <section class="card" aria-labelledby="hu-detail-record">
          <div class="card__header">
            <h2 class="hu-detail__title" id="hu-detail-record">Registro</h2>
          </div>
          <div class="card__body">
            <dl class="facts">
              <div><dt>Organização</dt><dd>{{ u.organization.name }}</dd></div>
              <div><dt>Criada em</dt><dd>{{ u.createdAt | date: 'short' }}</dd></div>
              <div><dt>Atualizada em</dt><dd>{{ u.updatedAt | date: 'short' }}</dd></div>
            </dl>
          </div>
        </section>
      }
    </div>

    <app-confirm-dialog
      [open]="confirmingInactivation()"
      title="Inativar unidade hospitalar"
      [message]="inactivateMessage"
      confirmLabel="Inativar unidade"
      [busy]="busy()"
      (confirmed)="changeStatus(false)"
      (cancelled)="confirmingInactivation.set(false)"
    />
  `,
  styles: [
    `
      .hu-detail__title {
        margin: 0;
        font-size: 1.05rem;
      }
      .hu-detail__multiline {
        white-space: pre-line;
      }
    `,
  ],
})
export class HospitalUnitDetailComponent implements OnInit {
  private readonly service = inject(OrganizationCatalogService);
  private readonly notifications = inject(NotificationService);
  private readonly store = inject(AuthStore);
  private readonly destroyRef = inject(DestroyRef);

  readonly unitGuid = input.required<string>();

  protected readonly screens = HOSPITAL_UNIT_SCREENS;
  protected readonly inactivateMessage = INACTIVATE_UNIT_MESSAGE;

  protected readonly unit = signal<HospitalUnitResponse | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly confirmingInactivation = signal(false);

  private readonly canChangeStatus = computed(() =>
    this.store.hasAll(HOSPITAL_UNIT_SCREENS.status),
  );

  /** Only filled fields; a section with nothing filled is omitted. */
  protected readonly sections = computed<DetailSection[]>(() => {
    const data = this.unit();
    if (!data) {
      return [];
    }
    return HOSPITAL_UNIT_SECTIONS.map((section) => ({
      id: section.id,
      title: section.title,
      rows: section.fields.flatMap((field): DetailRow[] => {
        const value = displayValue(field, data);
        return value === null
          ? []
          : [{ key: field.key, label: field.label, value, multiline: field.kind === 'textarea' }];
      }),
    })).filter((section) => section.rows.length > 0);
  });

  ngOnInit(): void {
    this.service
      .getHospitalUnit(this.unitGuid())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.unit.set(data);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.loading.set(false);
          const parsed = toApiError(err);
          this.error.set(
            parsed.status === 404
              ? 'A unidade hospitalar não foi encontrada ou não pertence à sua organização.'
              : parsed.message,
          );
        },
      });
  }

  /** Inactivation asks for confirmation; reactivation is applied directly. */
  protected requestStatusChange(): void {
    const current = this.unit();
    if (!current || this.busy() || !this.canChangeStatus()) {
      return;
    }
    if (current.active) {
      this.confirmingInactivation.set(true);
    } else {
      this.changeStatus(true);
    }
  }

  protected changeStatus(active: boolean): void {
    const current = this.unit();
    if (!current || this.busy() || !this.canChangeStatus()) {
      return;
    }
    this.busy.set(true);
    this.service
      .changeHospitalUnitStatus(current.guid, { active })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.unit.set(updated);
          this.busy.set(false);
          this.confirmingInactivation.set(false);
          this.notifications.success(
            updated.active ? 'Unidade hospitalar reativada.' : 'Unidade hospitalar inativada.',
          );
        },
        error: (err: unknown) => {
          this.busy.set(false);
          this.confirmingInactivation.set(false);
          this.notifications.error(toApiError(err).message);
        },
      });
  }
}
