import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { debounceTime } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { toApiError } from '../../core/http/api-error';
import { DEFAULT_PAGE_SIZE } from '../../core/models/api.models';
import { UserSummaryResponse } from '../../core/models/user.models';
import { NotificationService } from '../../core/notifications/notification.service';
import { PaginatorComponent } from '../../shared/components/paginator.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';
import { UsersService } from './users.service';

@Component({
  selector: 'app-users-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, DatePipe, PaginatorComponent, StatusBadgeComponent],
  template: `
    <div class="page stack">
      <header class="page__head">
        <div>
          <h1 class="page__title">Usuários e permissões</h1>
          <p class="page__subtitle">
            Somente usuários com vínculo de funcionário na sua organização. Selecione um usuário na
            lista para administrar suas permissões.
          </p>
        </div>
      </header>

      <form class="card" [formGroup]="filters">
        <div class="card__body row">
          <div class="field" style="flex: 2 1 260px">
            <label class="field__label" for="search">Buscar</label>
            <input
              id="search"
              class="input"
              type="search"
              formControlName="search"
              maxlength="254"
              placeholder="E-mail, nome ou matrícula"
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
              <th scope="col">E-mail</th>
              <th scope="col">Funcionário</th>
              <th scope="col">Unidade contratação</th>
              <th scope="col">Último login</th>
              <th scope="col">Versão perm.</th>
              <th scope="col">Situação</th>
              <th scope="col"></th>
            </tr>
          </thead>
          <tbody>
            @for (user of items(); track user.userGuid) {
              <tr>
                <td>{{ user.email }}</td>
                <td>
                  {{ user.employee.name }}
                  <div class="muted">Matrícula {{ user.employee.registrationNumber }}</div>
                </td>
                <td class="muted">{{ user.hiringUnit.name }}</td>
                <td class="muted">{{ user.lastLoginAt ? (user.lastLoginAt | date: 'short') : 'Nunca' }}</td>
                <td>{{ user.permissionVersion }}</td>
                <td>
                  <app-status-badge [active]="user.active" />
                  @if (user.temporarilyBlocked) {
                    <span class="badge badge--off" style="margin-left: 0.25rem">Bloqueado</span>
                  }
                </td>
                <td>
                  <a class="btn btn--ghost btn--sm" [routerLink]="[user.userGuid, 'permissoes']">
                    Permissões
                  </a>
                </td>
              </tr>
            } @empty {
              @if (!loading()) {
                <tr><td colspan="7"><div class="empty-state">Nenhum usuário encontrado.</div></td></tr>
              }
            }
            @if (loading()) {
              <tr><td colspan="7"><div class="empty-state"><span class="spinner"></span> Carregando…</div></td></tr>
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
export class UsersListComponent implements OnInit {
  private readonly service = inject(UsersService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly pageSize = DEFAULT_PAGE_SIZE;
  protected readonly page = signal(1);
  protected readonly total = signal(0);
  protected readonly items = signal<UserSummaryResponse[]>([]);
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
    this.loading.set(true);
    this.error.set(null);
    this.service
      .list({
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
