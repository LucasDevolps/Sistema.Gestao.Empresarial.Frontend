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
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { debounceTime } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { toApiError } from '../../core/http/api-error';
import { DEFAULT_PAGE_SIZE } from '../../core/models/api.models';
import { PositionResponse, ProfessionResponse } from '../../core/models/catalog.models';
import { NotificationService } from '../../core/notifications/notification.service';
import { PaginatorComponent } from '../../shared/components/paginator.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';
import { HasPermissionDirective } from '../../shared/directives/has-permission.directive';
import { CATALOG_KINDS, CatalogKind } from './catalog-kind';
import { ProfessionalCatalogService } from './professional-catalog.service';

type CatalogRow = ProfessionResponse | PositionResponse;

@Component({
  selector: 'app-catalog-list',
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
          <h1 class="page__title">{{ config().titlePlural }}</h1>
          <p class="page__subtitle">
            O domínio usa inativação — não há exclusão física (spec seções 29, 30, 33).
          </p>
        </div>
        <a *appHasPermission="config().create" class="btn btn--accent" routerLink="novo">
          {{ 'Nova ' + config().titleSingular.toLowerCase() }}
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
              [maxlength]="config().searchMaxLength"
              placeholder="Nome"
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
                    *appHasPermission="config().edit"
                    class="btn btn--ghost btn--sm"
                    [routerLink]="[row.guid, 'editar']"
                  >
                    Editar
                  </a>
                </td>
              </tr>
            } @empty {
              @if (!loading()) {
                <tr><td colspan="4"><div class="empty-state">Nenhum registro encontrado.</div></td></tr>
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
export class CatalogListComponent implements OnInit {
  private readonly service = inject(ProfessionalCatalogService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly kind = input.required<CatalogKind>();
  protected readonly config = computed(() => CATALOG_KINDS[this.kind()]);

  protected readonly pageSize = DEFAULT_PAGE_SIZE;
  protected readonly page = signal(1);
  protected readonly total = signal(0);
  protected readonly items = signal<CatalogRow[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly filters = new FormGroup({
    search: new FormControl<string>('', { nonNullable: true }),
    active: new FormControl<string>('', { nonNullable: true }),
  });

  ngOnInit(): void {
    this.filters.valueChanges.pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef)).subscribe(() => {
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
    const query = {
      search: raw.search.trim() || null,
      active: raw.active === '' ? null : raw.active === 'true',
      page: this.page(),
      pageSize: this.pageSize,
    };
    this.loading.set(true);
    this.error.set(null);
    const request$ =
      this.kind() === 'profession'
        ? this.service.listProfessions(query)
        : this.service.listPositions(query);
    request$.subscribe({
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
