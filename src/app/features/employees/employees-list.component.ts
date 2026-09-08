import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { debounceTime } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { toApiError } from '../../core/http/api-error';
import { DEFAULT_PAGE_SIZE } from '../../core/models/api.models';
import { EmployeeSummaryResponse } from '../../core/models/employee.models';
import { HospitalUnitResponse } from '../../core/models/organization.models';
import { NotificationService } from '../../core/notifications/notification.service';
import { PaginatorComponent } from '../../shared/components/paginator.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';
import { HasPermissionDirective } from '../../shared/directives/has-permission.directive';
import { OrganizationCatalogService } from '../organization/organization-catalog.service';
import { EmployeesService } from './employees.service';

@Component({
  selector: 'app-employees-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    PaginatorComponent,
    StatusBadgeComponent,
    HasPermissionDirective,
  ],
  template: `
    <div class="page stack">
      <header class="page__head">
        <div>
          <h1 class="page__title">Funcionários</h1>
          <p class="page__subtitle">Consulta paginada no servidor, dentro do escopo da sua organização.</p>
        </div>
        <a *appHasPermission="'FUNCIONARIO_CRIAR'" class="btn btn--accent" routerLink="novo">
          Novo funcionário
        </a>
      </header>

      <form class="card" [formGroup]="filters">
        <div class="card__body row">
          <div class="field" style="flex: 2 1 240px">
            <label class="field__label" for="search">Buscar</label>
            <input
              id="search"
              class="input"
              type="search"
              formControlName="search"
              maxlength="200"
              placeholder="Nome, e-mail ou matrícula"
            />
          </div>
          <div class="field" style="flex: 1 1 160px">
            <label class="field__label" for="active">Situação</label>
            <select id="active" class="select" formControlName="active">
              <option value="">Todas</option>
              <option value="true">Ativos</option>
              <option value="false">Inativos</option>
            </select>
          </div>
          <div class="field" style="flex: 1 1 220px">
            <label class="field__label" for="unit">Unidade de atuação</label>
            <select id="unit" class="select" formControlName="actingUnitGuid">
              <option value="">Todas</option>
              @for (unit of units(); track unit.guid) {
                <option [value]="unit.guid">{{ unit.name }}</option>
              }
            </select>
          </div>
        </div>
      </form>

      @if (error()) {
        <p class="card__body muted" role="alert">{{ error() }}</p>
      }

      <div class="table-wrap">
        <table class="data">
          <thead>
            <tr>
              <th scope="col">Matrícula</th>
              <th scope="col">Nome</th>
              <th scope="col">Profissão</th>
              <th scope="col">Cargo</th>
              <th scope="col">Nível</th>
              <th scope="col">Unidade contratação</th>
              <th scope="col">Situação</th>
            </tr>
          </thead>
          <tbody>
            @for (employee of items(); track employee.guid) {
              <tr>
                <td>{{ employee.registrationNumber }}</td>
                <td>
                  <a [routerLink]="[employee.guid]">{{ employee.name }}</a>
                  <div class="muted">{{ employee.email }}</div>
                </td>
                <td>{{ employee.profession.name }}</td>
                <td>{{ employee.position.name }}</td>
                <td>{{ employee.level.code }} · {{ employee.level.name }}</td>
                <td>{{ employee.hiringUnit.name }}</td>
                <td><app-status-badge [active]="employee.active" /></td>
              </tr>
            } @empty {
              @if (!loading()) {
                <tr>
                  <td colspan="7"><div class="empty-state">Nenhum funcionário encontrado.</div></td>
                </tr>
              }
            }
            @if (loading()) {
              <tr>
                <td colspan="7"><div class="empty-state"><span class="spinner"></span> Carregando…</div></td>
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
  `,
})
export class EmployeesListComponent implements OnInit {
  private readonly service = inject(EmployeesService);
  private readonly catalog = inject(OrganizationCatalogService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly pageSize = DEFAULT_PAGE_SIZE;
  protected readonly page = signal(1);
  protected readonly total = signal(0);
  protected readonly items = signal<EmployeeSummaryResponse[]>([]);
  protected readonly units = signal<HospitalUnitResponse[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly filters = new FormGroup({
    search: new FormControl<string>('', { nonNullable: true }),
    active: new FormControl<string>('', { nonNullable: true }),
    actingUnitGuid: new FormControl<string>('', { nonNullable: true }),
  });

  ngOnInit(): void {
    this.filters.valueChanges.pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.page.set(1);
      this.load();
    });

    this.catalog.listHospitalUnits({ active: true, page: 1, pageSize: 100 }).subscribe({
      next: (result) => this.units.set(result.items),
      error: () => {
        // Non-blocking: the filter simply stays empty if units cannot be listed.
      },
    });

    this.load();
  }

  protected goToPage(page: number): void {
    this.page.set(page);
    this.load();
  }

  private load(): void {
    const raw = this.filters.getRawValue();
    this.loading.set(true);
    this.error.set(null);
    this.service
      .list({
        search: raw.search.trim() || null,
        active: raw.active === '' ? null : raw.active === 'true',
        actingUnitGuid: raw.actingUnitGuid || null,
        page: this.page(),
        pageSize: this.pageSize,
      })
      .subscribe({
        next: (result) => {
          this.items.set(result.items);
          this.total.set(result.total);
          this.page.set(result.page);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.loading.set(false);
          this.items.set([]);
          this.total.set(0);
          const parsed = toApiError(err);
          this.error.set(parsed.message);
          if (parsed.status !== 403) {
            this.notifications.error(parsed.message);
          }
        },
      });
  }
}
