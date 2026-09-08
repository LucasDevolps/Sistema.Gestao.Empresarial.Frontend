import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { toApiError } from '../../core/http/api-error';
import { ProfessionalLevelResponse } from '../../core/models/catalog.models';
import { NotificationService } from '../../core/notifications/notification.service';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';
import { ProfessionalCatalogService } from './professional-catalog.service';

/**
 * Read-only view of `/api/niveis-profissionais`. The backend exposes only
 * consultation for professional levels (spec section 31).
 */
@Component({
  selector: 'app-professional-levels',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, StatusBadgeComponent],
  template: `
    <div class="page stack">
      <header class="page__head">
        <div>
          <h1 class="page__title">Níveis profissionais</h1>
          <p class="page__subtitle">Somente consulta. Os valores vêm integralmente do backend.</p>
        </div>
        <label class="row" style="align-items: center; gap: 0.5rem">
          <input type="checkbox" [formControl]="onlyActive" />
          <span>Somente ativos</span>
        </label>
      </header>

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
              <th scope="col">Situação</th>
            </tr>
          </thead>
          <tbody>
            @for (level of levels(); track level.guid) {
              <tr>
                <td>{{ level.order }}</td>
                <td>{{ level.code }}</td>
                <td>{{ level.name }}</td>
                <td><app-status-badge [active]="level.active" /></td>
              </tr>
            } @empty {
              @if (!loading()) {
                <tr><td colspan="4"><div class="empty-state">Nenhum nível encontrado.</div></td></tr>
              }
            }
            @if (loading()) {
              <tr><td colspan="4"><div class="empty-state"><span class="spinner"></span> Carregando…</div></td></tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
})
export class ProfessionalLevelsComponent implements OnInit {
  private readonly service = inject(ProfessionalCatalogService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly levels = signal<ProfessionalLevelResponse[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly onlyActive = new FormControl<boolean>(false, { nonNullable: true });

  ngOnInit(): void {
    this.onlyActive.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.load());
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.service.listLevels(this.onlyActive.value ? true : null).subscribe({
      next: (data) => {
        this.levels.set([...data].sort((a, b) => a.order - b.order));
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.levels.set([]);
        const parsed = toApiError(err);
        this.error.set(parsed.message);
        if (parsed.status !== 403) {
          this.notifications.error(parsed.message);
        }
      },
    });
  }
}
