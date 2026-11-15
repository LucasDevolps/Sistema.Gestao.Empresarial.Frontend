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
import { WORK_SCHEDULE_SCREENS } from '../../core/auth/screen-permissions';
import { toApiError } from '../../core/http/api-error';
import { DEFAULT_PAGE_SIZE, PageQuery } from '../../core/models/api.models';
import { WORK_SCHEDULE_LIMITS, WorkScheduleResponse } from '../../core/models/work-schedule.models';
import { NotificationService } from '../../core/notifications/notification.service';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog.component';
import { PaginatorComponent } from '../../shared/components/paginator.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';
import { HasPermissionDirective } from '../../shared/directives/has-permission.directive';
import { WorkScheduleService } from './work-schedule.service';

@Component({
  selector: 'app-work-schedules-list',
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
  templateUrl: './work-schedules-list.component.html',
  styleUrl: './work-schedules-list.component.scss',
})
export class WorkSchedulesListComponent implements OnInit {
  private readonly service = inject(WorkScheduleService);
  private readonly notifications = inject(NotificationService);
  private readonly store = inject(AuthStore);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly screens = WORK_SCHEDULE_SCREENS;
  protected readonly limits = WORK_SCHEDULE_LIMITS;
  protected readonly pageSize = DEFAULT_PAGE_SIZE;

  protected readonly page = signal(1);
  protected readonly total = signal(0);
  protected readonly items = signal<WorkScheduleResponse[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly hasFilters = signal(false);

  protected readonly statusBusy = signal<string | null>(null);
  protected readonly pendingInactivation = signal<WorkScheduleResponse | null>(null);
  protected readonly inactivateMessage = computed(() => {
    const schedule = this.pendingInactivation();
    return schedule
      ? `Deseja inativar a jornada "${schedule.name}"? Ela continuará no histórico, mas não poderá ser escolhida em novos vínculos.`
      : '';
  });
  private readonly canChangeStatus = computed(() =>
    this.store.hasAll(WORK_SCHEDULE_SCREENS.status),
  );

  protected readonly filters = new FormGroup({
    search: new FormControl('', { nonNullable: true }),
    active: new FormControl('', { nonNullable: true }),
  });

  private readonly reload$ = new Subject<void>();

  ngOnInit(): void {
    this.reload$
      .pipe(
        switchMap(() => {
          this.loading.set(true);
          this.error.set(null);
          return this.service.list(this.currentQuery()).pipe(
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
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
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

  protected requestStatusChange(schedule: WorkScheduleResponse): void {
    if (!this.canChangeStatus() || this.statusBusy() !== null) {
      return;
    }
    if (schedule.active) {
      this.pendingInactivation.set(schedule);
    } else {
      this.changeStatus(schedule, true);
    }
  }

  protected confirmInactivation(): void {
    const schedule = this.pendingInactivation();
    if (schedule && this.statusBusy() === null) {
      this.changeStatus(schedule, false);
    }
  }

  protected cancelInactivation(): void {
    if (this.statusBusy() === null) {
      this.pendingInactivation.set(null);
    }
  }

  private changeStatus(schedule: WorkScheduleResponse, active: boolean): void {
    this.statusBusy.set(schedule.guid);
    this.service
      .changeStatus(schedule.guid, { active })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.statusBusy.set(null);
          this.pendingInactivation.set(null);
          this.notifications.success(
            updated.active ? 'Jornada de trabalho reativada.' : 'Jornada de trabalho inativada.',
          );
          if (this.filters.controls.active.value !== '') {
            if (this.items().length === 1 && this.page() > 1) {
              this.page.update((current) => current - 1);
            }
            this.reload$.next();
            return;
          }
          this.items.update((rows) => rows.map((row) => (row.guid === updated.guid ? updated : row)));
        },
        error: (err: unknown) => {
          this.statusBusy.set(null);
          this.pendingInactivation.set(null);
          const parsed = toApiError(err);
          if (parsed.status === 404) {
            this.notifications.warning('Esta jornada de trabalho não existe mais. A lista foi atualizada.');
            this.reload$.next();
            return;
          }
          this.notifications.error(parsed.message);
        },
      });
  }

  private currentQuery(): PageQuery {
    const raw = this.filters.getRawValue();
    const query: PageQuery = {
      search: raw.search.trim() || null,
      active: raw.active === '' ? null : raw.active === 'true',
      page: this.page(),
      pageSize: this.pageSize,
    };
    this.hasFilters.set(query.search !== null || query.active !== null);
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
