import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { debounceTime } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthStore } from '../../core/auth/auth-store';
import { PROFESSIONAL_LEVEL_SCREENS } from '../../core/auth/screen-permissions';
import { toApiError } from '../../core/http/api-error';
import { DEFAULT_PAGE_SIZE } from '../../core/models/api.models';
import { ProfessionalLevelResponse } from '../../core/models/catalog.models';
import { NotificationService } from '../../core/notifications/notification.service';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog.component';
import { PaginatorComponent } from '../../shared/components/paginator.component';
import { HasPermissionDirective } from '../../shared/directives/has-permission.directive';
import { ProfessionalCatalogService } from './professional-catalog.service';

/** Backend `search` max length (`ProfessionalCatalogListQueryValidator`). */
const SEARCH_MAX_LENGTH = 150;

/**
 * The only business rule behind a 422 on `POST /api/niveis-profissionais/{guid}/excluir`
 * is "level linked to employees"; the API's ProblemDetails carries only a generic
 * title, so the message is resolved here for this action.
 */
const LEVEL_IN_USE_MESSAGE =
  'Este nível profissional está vinculado a funcionários e não pode ser excluído.';

/**
 * Management screen for `/api/niveis-profissionais`: a configurable catalog that
 * the manager creates, edits and deletes logically. The backend orders by
 * `order` then `name`; deleted levels never come back from the API.
 */
@Component({
  selector: 'app-professional-levels',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    PaginatorComponent,
    HasPermissionDirective,
    ConfirmDialogComponent,
  ],
  template: `
    <div class="page stack">
      <header class="page__head">
        <div>
          <h1 class="page__title">Níveis profissionais</h1>
          <p class="page__subtitle">
            Catálogo configurável usado na classificação dos funcionários. A exclusão é lógica e só é
            permitida para níveis sem funcionários vinculados.
          </p>
        </div>
        <a *appHasPermission="screens.create" class="btn btn--accent" routerLink="novo">
          Novo nível profissional
        </a>
      </header>

      <div class="card">
        <div class="card__body row">
          <div class="field" style="flex: 2 1 240px">
            <label class="field__label" for="search">Buscar</label>
            <input
              id="search"
              class="input"
              type="search"
              [formControl]="search"
              [maxlength]="searchMaxLength"
              placeholder="Código ou nome"
            />
          </div>
        </div>
      </div>

      @if (error()) {
        <p class="card__body muted" role="alert">{{ error() }}</p>
      }

      <div class="table-wrap">
        <table class="data">
          <thead>
            <tr>
              <th scope="col">Ordem</th>
              <th scope="col">Código</th>
              <th scope="col">Nome</th>
              <th scope="col"><span class="visually-hidden">Ações</span></th>
            </tr>
          </thead>
          <tbody>
            @for (level of levels(); track level.guid) {
              <tr>
                <td>{{ level.order }}</td>
                <td>{{ level.code }}</td>
                <td>{{ level.name }}</td>
                <td>
                  <div class="row-actions">
                    <a
                      *appHasPermission="screens.edit"
                      class="btn btn--ghost btn--sm"
                      [routerLink]="[level.guid, 'editar']"
                      [attr.aria-label]="'Editar nível ' + level.name"
                    >
                      Editar
                    </a>
                    <button
                      *appHasPermission="screens.delete"
                      type="button"
                      class="btn btn--ghost btn--sm"
                      [disabled]="deleting()"
                      [attr.aria-label]="'Excluir nível ' + level.name"
                      (click)="requestDelete(level)"
                    >
                      Excluir
                    </button>
                  </div>
                </td>
              </tr>
            } @empty {
              @if (!loading() && !error()) {
                <tr>
                  <td colspan="4">
                    <div class="empty-state">
                      {{
                        hasSearch()
                          ? 'Nenhum nível profissional encontrado para a busca.'
                          : 'Nenhum nível profissional cadastrado.'
                      }}
                    </div>
                  </td>
                </tr>
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

    <app-confirm-dialog
      [open]="pendingDelete() !== null"
      title="Excluir nível profissional"
      [message]="deleteMessage()"
      confirmLabel="Excluir"
      [busy]="deleting()"
      (confirmed)="confirmDelete()"
      (cancelled)="cancelDelete()"
    />
  `,
  styles: [
    `
      .row-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        justify-content: flex-end;
      }
    `,
  ],
})
export class ProfessionalLevelsComponent implements OnInit {
  private readonly service = inject(ProfessionalCatalogService);
  private readonly notifications = inject(NotificationService);
  private readonly store = inject(AuthStore);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly screens = PROFESSIONAL_LEVEL_SCREENS;
  protected readonly searchMaxLength = SEARCH_MAX_LENGTH;
  protected readonly pageSize = DEFAULT_PAGE_SIZE;

  protected readonly page = signal(1);
  protected readonly total = signal(0);
  protected readonly levels = signal<ProfessionalLevelResponse[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly hasSearch = signal(false);

  protected readonly pendingDelete = signal<ProfessionalLevelResponse | null>(null);
  protected readonly deleting = signal(false);
  protected readonly deleteMessage = computed(() => {
    const level = this.pendingDelete();
    return level
      ? `Deseja excluir o nível "${level.code} · ${level.name}"? Ele deixará de aparecer nas consultas e no cadastro de funcionários.`
      : '';
  });
  private readonly canDelete = computed(() => this.store.hasAll(PROFESSIONAL_LEVEL_SCREENS.delete));

  protected readonly search = new FormControl<string>('', { nonNullable: true });

  ngOnInit(): void {
    this.search.valueChanges
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

  protected requestDelete(level: ProfessionalLevelResponse): void {
    // Defence in depth: the button is already hidden without the permission and
    // the backend remains the definitive barrier.
    if (!this.canDelete() || this.deleting()) {
      return;
    }
    this.pendingDelete.set(level);
  }

  protected cancelDelete(): void {
    if (!this.deleting()) {
      this.pendingDelete.set(null);
    }
  }

  protected confirmDelete(): void {
    const level = this.pendingDelete();
    if (!level || this.deleting()) {
      return;
    }
    this.deleting.set(true);
    this.service.deleteLevel(level.guid).subscribe({
      next: () => {
        this.deleting.set(false);
        this.pendingDelete.set(null);
        this.notifications.success('Nível profissional excluído.');
        // Deleting the last row of a page must not leave the user on an empty page.
        if (this.levels().length === 1 && this.page() > 1) {
          this.page.update((current) => current - 1);
        }
        this.load();
      },
      error: (err: unknown) => {
        this.deleting.set(false);
        this.pendingDelete.set(null);
        const parsed = toApiError(err);
        if (parsed.status === 422) {
          this.notifications.error(LEVEL_IN_USE_MESSAGE);
          return;
        }
        if (parsed.status === 404) {
          this.notifications.warning('Este nível profissional não existe mais. A lista foi atualizada.');
          this.load();
          return;
        }
        this.notifications.error(parsed.message);
      },
    });
  }

  private load(): void {
    const search = this.search.value.trim();
    this.hasSearch.set(search.length > 0);
    this.loading.set(true);
    this.error.set(null);
    this.service
      .listLevels({ search: search || null, page: this.page(), pageSize: this.pageSize })
      .subscribe({
        next: (result) => {
          this.levels.set(result.items);
          this.total.set(result.total);
          this.page.set(result.page);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.loading.set(false);
          this.levels.set([]);
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
