import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { debounceTime } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SECTOR_CATEGORY_SCREENS } from '../../core/auth/screen-permissions';
import { toApiError } from '../../core/http/api-error';
import { DEFAULT_PAGE_SIZE } from '../../core/models/api.models';
import { SectorCategoryResponse } from '../../core/models/organization.models';
import { NotificationService } from '../../core/notifications/notification.service';
import { PaginatorComponent } from '../../shared/components/paginator.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';
import { HasPermissionDirective } from '../../shared/directives/has-permission.directive';
import { OrganizationCatalogService } from './organization-catalog.service';

@Component({
  selector: 'app-sector-categories-list',
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
          <h1 class="page__title">Categorias de setor</h1>
          <p class="page__subtitle">
            Classificam os setores hospitalares. Usam inativação — não há exclusão física.
          </p>
        </div>
        <a *appHasPermission="'CATEGORIA_SETOR_CRIAR'" class="btn btn--accent" routerLink="nova">
          Nova categoria
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
              maxlength="120"
              placeholder="Nome"
            />
          </div>
          <div class="field" style="flex: 1 1 160px">
            <label class="field__label" for="active">Situação</label>
            <select id="active" class="select" formControlName="active">
              <option value="">Todas</option>
              <option value="true">Ativas</option>
              <option value="false">Inativas</option>
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
              <th scope="col">Nome</th>
              <th scope="col">Descrição</th>
              <th scope="col">Situação</th>
              <th scope="col"></th>
            </tr>
          </thead>
          <tbody>
            @for (row of items(); track row.guid) {
              <tr>
                <td>{{ row.name }}</td>
                <td class="muted">{{ row.description || '—' }}</td>
                <td><app-status-badge [active]="row.active" /></td>
                <td>
                  <a
                    *appHasPermission="editCategoryScreen"
                    class="btn btn--ghost btn--sm"
                    [routerLink]="[row.guid, 'editar']"
                  >
                    Editar
                  </a>
                </td>
              </tr>
            } @empty {
              @if (!loading()) {
                <tr><td colspan="4"><div class="empty-state">Nenhuma categoria encontrada.</div></td></tr>
              }
            }
            @if (loading()) {
              <tr><td colspan="4"><div class="empty-state"><span class="spinner"></span> Carregando…</div></td></tr>
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
export class SectorCategoriesListComponent implements OnInit {
  private readonly service = inject(OrganizationCatalogService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  /** "Editar" mirrors the route guard: reads the record and then writes it. */
  protected readonly editCategoryScreen = SECTOR_CATEGORY_SCREENS.edit;

  protected readonly pageSize = DEFAULT_PAGE_SIZE;
  protected readonly page = signal(1);
  protected readonly total = signal(0);
  protected readonly items = signal<SectorCategoryResponse[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly filters = new FormGroup({
    search: new FormControl<string>('', { nonNullable: true }),
    active: new FormControl<string>('', { nonNullable: true }),
  });

  ngOnInit(): void {
    this.filters.valueChanges
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.page.set(1);
        this.load();
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
      .listSectorCategories({
        search: raw.search.trim() || null,
        active: raw.active === '' ? null : raw.active === 'true',
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
