import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { EMPTY, Subject, catchError, debounceTime, switchMap } from 'rxjs';
import { AuthStore } from '../../core/auth/auth-store';
import { HOSPITAL_UNIT_SCREENS } from '../../core/auth/screen-permissions';
import { toApiError } from '../../core/http/api-error';
import { DEFAULT_PAGE_SIZE } from '../../core/models/api.models';
import {
  HospitalUnitListQuery,
  HospitalUnitSummaryResponse,
} from '../../core/models/organization.models';
import { NotificationService } from '../../core/notifications/notification.service';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog.component';
import { PaginatorComponent } from '../../shared/components/paginator.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';
import { HasPermissionDirective } from '../../shared/directives/has-permission.directive';
import { BRAZILIAN_STATES, formatCnpj, onlyDigits } from '../../shared/format/brazilian-formats';
import { INACTIVATE_UNIT_MESSAGE } from './hospital-unit-sections';
import { OrganizationCatalogService } from './organization-catalog.service';

/**
 * Paginated list of the hospital units of the caller's organization (the
 * backend scopes it; there is no organization selector). Uses the summary
 * projection of `GET /api/unidades-hospitalares` — never one detail GET per row.
 */
@Component({
  selector: 'app-hospital-units-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    PaginatorComponent,
    StatusBadgeComponent,
    HasPermissionDirective,
    ConfirmDialogComponent,
  ],
  template: `
    <div class="page stack">
      <header class="page__head">
        <div>
          <h1 class="page__title">Unidades hospitalares</h1>
          <p class="page__subtitle">
            Unidades da sua organização. A busca é restrita à organização do seu vínculo pelo servidor.
          </p>
        </div>
        <a *appHasPermission="screens.create" class="btn btn--accent" routerLink="novo">
          Nova unidade
        </a>
      </header>

      <form class="card" [formGroup]="filters" (ngSubmit)="reloadNow()" aria-label="Filtros de unidades">
        <div class="card__body hu-filters">
          <div class="field">
            <label class="field__label" for="f-search">Nome fantasia</label>
            <input id="f-search" class="input" type="search" formControlName="search" maxlength="200" />
          </div>
          <div class="field">
            <label class="field__label" for="f-legal">Razão social</label>
            <input id="f-legal" class="input" type="search" formControlName="legalName" maxlength="200" />
          </div>
          <div class="field">
            <label class="field__label" for="f-cnpj">CNPJ</label>
            <input
              id="f-cnpj"
              class="input"
              type="search"
              inputmode="numeric"
              formControlName="cnpj"
              maxlength="18"
              aria-describedby="f-cnpj-hint"
            />
            <span id="f-cnpj-hint" class="field__hint">Número completo.</span>
          </div>
          <div class="field">
            <label class="field__label" for="f-cnes">CNES</label>
            <input
              id="f-cnes"
              class="input"
              type="search"
              inputmode="numeric"
              formControlName="cnes"
              maxlength="7"
              aria-describedby="f-cnes-hint"
            />
            <span id="f-cnes-hint" class="field__hint">7 dígitos.</span>
          </div>
          <div class="field">
            <label class="field__label" for="f-city">Município</label>
            <input id="f-city" class="input" type="search" formControlName="city" maxlength="100" />
          </div>
          <div class="field">
            <label class="field__label" for="f-state">UF</label>
            <select id="f-state" class="select" formControlName="state">
              <option value="">Todas</option>
              @for (uf of states; track uf) {
                <option [value]="uf">{{ uf }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label class="field__label" for="f-active">Situação</label>
            <select id="f-active" class="select" formControlName="active">
              <option value="">Todas</option>
              <option value="true">Ativas</option>
              <option value="false">Inativas</option>
            </select>
          </div>
          <div class="field hu-filters__actions">
            <button type="button" class="btn btn--ghost" [disabled]="!hasFilters()" (click)="clearFilters()">
              Limpar filtros
            </button>
          </div>
        </div>
      </form>

      @if (error()) {
        <p class="card__body muted" role="alert">{{ error() }}</p>
      }

      <div class="table-wrap">
        <table class="data" [attr.aria-busy]="loading()">
          <caption class="visually-hidden">Unidades hospitalares</caption>
          <thead>
            <tr>
              <th scope="col">Nome fantasia</th>
              <th scope="col" class="hu-optional">Razão social</th>
              <th scope="col">CNPJ</th>
              <th scope="col" class="hu-optional">CNES</th>
              <th scope="col">Cidade/UF</th>
              <th scope="col" class="hu-optional">Organização</th>
              <th scope="col">Situação</th>
              <th scope="col"><span class="visually-hidden">Ações</span></th>
            </tr>
          </thead>
          <tbody>
            @for (unit of items(); track unit.guid) {
              <tr>
                <td><a [routerLink]="[unit.guid]">{{ unit.name }}</a></td>
                <td class="hu-optional">{{ unit.legalName ?? '' }}</td>
                <td class="hu-nowrap">{{ unit.cnpj ? formatCnpj(unit.cnpj) : '' }}</td>
                <td class="hu-optional">{{ unit.cnes ?? '' }}</td>
                <td>{{ location(unit) }}</td>
                <td class="hu-optional muted">{{ unit.organization.name }}</td>
                <td>
                  <app-status-badge [active]="unit.active" activeLabel="Ativa" inactiveLabel="Inativa" />
                </td>
                <td>
                  <div class="hu-row-actions">
                    <a
                      class="btn btn--ghost btn--sm"
                      [routerLink]="[unit.guid]"
                      [attr.aria-label]="'Visualizar ' + unit.name"
                    >
                      Visualizar
                    </a>
                    <a
                      *appHasPermission="screens.edit"
                      class="btn btn--ghost btn--sm"
                      [routerLink]="[unit.guid, 'editar']"
                      [attr.aria-label]="'Editar ' + unit.name"
                    >
                      Editar
                    </a>
                    <button
                      *appHasPermission="screens.status"
                      type="button"
                      class="btn btn--ghost btn--sm"
                      [disabled]="statusBusy() !== null"
                      [attr.aria-label]="(unit.active ? 'Inativar ' : 'Reativar ') + unit.name"
                      (click)="requestStatusChange(unit)"
                    >
                      @if (statusBusy() === unit.guid) {
                        <span class="spinner" aria-hidden="true"></span>
                      }
                      {{ unit.active ? 'Inativar' : 'Reativar' }}
                    </button>
                  </div>
                </td>
              </tr>
            } @empty {
              @if (!loading() && !error()) {
                <tr>
                  <td colspan="8">
                    <div class="empty-state">
                      {{
                        hasFilters()
                          ? 'Nenhuma unidade encontrada para os filtros informados.'
                          : 'Nenhuma unidade hospitalar cadastrada.'
                      }}
                    </div>
                  </td>
                </tr>
              }
            }
            @if (loading()) {
              <tr>
                <td colspan="8">
                  <div class="empty-state" role="status">
                    <span class="spinner" aria-hidden="true"></span> Carregando…
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <app-paginator
        [page]="page()"
        [pageSize]="pageSize"
        [total]="total()"
        [disabled]="loading()"
        (pageChange)="goToPage($event)"
      />
    </div>

    <app-confirm-dialog
      [open]="pendingInactivation() !== null"
      title="Inativar unidade hospitalar"
      [message]="inactivateMessage"
      confirmLabel="Inativar unidade"
      [busy]="statusBusy() !== null"
      (confirmed)="confirmInactivation()"
      (cancelled)="cancelInactivation()"
    />
  `,
  styles: [
    `
      .hu-filters {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(100%, 170px), 1fr));
        gap: 0 1rem;
        align-items: start;
      }
      .hu-filters > * {
        min-width: 0;
      }
      .hu-filters__actions {
        align-self: end;
      }
      .hu-row-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem;
        justify-content: flex-end;
      }
      .hu-nowrap {
        white-space: nowrap;
      }
      /* Secondary columns give way on narrow screens; the detail shows them all. */
      @media (max-width: 820px) {
        .hu-optional {
          display: none;
        }
      }
    `,
  ],
})
export class HospitalUnitsListComponent implements OnInit {
  private readonly service = inject(OrganizationCatalogService);
  private readonly notifications = inject(NotificationService);
  private readonly store = inject(AuthStore);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly screens = HOSPITAL_UNIT_SCREENS;
  protected readonly states = BRAZILIAN_STATES;
  protected readonly inactivateMessage = INACTIVATE_UNIT_MESSAGE;
  protected readonly formatCnpj = formatCnpj;
  protected readonly pageSize = DEFAULT_PAGE_SIZE;

  protected readonly page = signal(1);
  protected readonly total = signal(0);
  protected readonly items = signal<HospitalUnitSummaryResponse[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly hasFilters = signal(false);

  /** Guid of the row whose status is being changed (one at a time). */
  protected readonly statusBusy = signal<string | null>(null);
  protected readonly pendingInactivation = signal<HospitalUnitSummaryResponse | null>(null);
  private readonly canChangeStatus = computed(() =>
    this.store.hasAll(HOSPITAL_UNIT_SCREENS.status),
  );

  protected readonly filters = new FormGroup({
    search: new FormControl('', { nonNullable: true }),
    legalName: new FormControl('', { nonNullable: true }),
    cnpj: new FormControl('', { nonNullable: true }),
    cnes: new FormControl('', { nonNullable: true }),
    city: new FormControl('', { nonNullable: true }),
    state: new FormControl('', { nonNullable: true }),
    active: new FormControl('', { nonNullable: true }),
  });

  /** Every reload goes through here so a newer query cancels the one in flight. */
  private readonly reload$ = new Subject<void>();

  ngOnInit(): void {
    this.reload$
      .pipe(
        switchMap(() => {
          this.loading.set(true);
          this.error.set(null);
          // Errors are handled per request so one failure never ends the stream.
          return this.service.listHospitalUnits(this.currentQuery()).pipe(
            catchError((err: unknown) => {
              this.onLoadError(err);
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        this.items.set(result.items);
        this.total.set(result.total);
        this.page.set(result.page);
        this.loading.set(false);
      });

    this.filters.valueChanges
      .pipe(debounceTime(400), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.page.set(1);
        this.reload$.next();
      });

    this.reload$.next();
  }

  protected reloadNow(): void {
    this.page.set(1);
    this.reload$.next();
  }

  protected goToPage(page: number): void {
    this.page.set(page);
    this.reload$.next();
  }

  protected clearFilters(): void {
    this.filters.reset();
  }

  protected location(unit: HospitalUnitSummaryResponse): string {
    return [unit.city, unit.state].filter((part) => !!part).join('/');
  }

  protected requestStatusChange(unit: HospitalUnitSummaryResponse): void {
    if (!this.canChangeStatus() || this.statusBusy() !== null) {
      return;
    }
    if (unit.active) {
      this.pendingInactivation.set(unit);
    } else {
      this.changeStatus(unit, true);
    }
  }

  protected confirmInactivation(): void {
    const unit = this.pendingInactivation();
    if (unit) {
      this.changeStatus(unit, false);
    }
  }

  protected cancelInactivation(): void {
    if (this.statusBusy() === null) {
      this.pendingInactivation.set(null);
    }
  }

  private changeStatus(unit: HospitalUnitSummaryResponse, active: boolean): void {
    this.statusBusy.set(unit.guid);
    this.service
      .changeHospitalUnitStatus(unit.guid, { active })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.items.update((rows) =>
            rows.map((row) =>
              row.guid === updated.guid
                ? { ...row, active: updated.active, updatedAt: updated.updatedAt }
                : row,
            ),
          );
          this.statusBusy.set(null);
          this.pendingInactivation.set(null);
          this.notifications.success(
            updated.active ? 'Unidade hospitalar reativada.' : 'Unidade hospitalar inativada.',
          );
        },
        error: (err: unknown) => {
          this.statusBusy.set(null);
          this.pendingInactivation.set(null);
          this.notifications.error(toApiError(err).message);
        },
      });
  }

  private currentQuery(): HospitalUnitListQuery {
    const raw = this.filters.getRawValue();
    const text = (value: string) => value.trim() || null;
    const digits = (value: string) => onlyDigits(value) || null;
    const query: HospitalUnitListQuery = {
      search: text(raw.search),
      legalName: text(raw.legalName),
      cnpj: digits(raw.cnpj),
      cnes: digits(raw.cnes),
      city: text(raw.city),
      state: raw.state || null,
      active: raw.active === '' ? null : raw.active === 'true',
      page: this.page(),
      pageSize: this.pageSize,
    };
    this.hasFilters.set(
      [query.search, query.legalName, query.cnpj, query.cnes, query.city, query.state, query.active].some(
        (value) => value !== null,
      ),
    );
    return query;
  }

  private onLoadError(err: unknown): void {
    this.loading.set(false);
    this.items.set([]);
    this.total.set(0);
    const parsed = toApiError(err);
    this.error.set(parsed.message);
    if (parsed.status !== 403) {
      this.notifications.error(parsed.message);
    }
  }
}
