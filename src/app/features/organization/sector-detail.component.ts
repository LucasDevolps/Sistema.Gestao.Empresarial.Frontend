import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthStore } from '../../core/auth/auth-store';
import { describeFieldErrors, toApiError } from '../../core/http/api-error';
import { HospitalUnitResponse, SectorResponse } from '../../core/models/organization.models';
import { NotificationService } from '../../core/notifications/notification.service';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';
import { HasPermissionDirective } from '../../shared/directives/has-permission.directive';
import { DateOnlyPipe } from '../../shared/pipes/date-only.pipe';
import { OrganizationCatalogService } from './organization-catalog.service';

@Component({
  selector: 'app-sector-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    DatePipe,
    DateOnlyPipe,
    StatusBadgeComponent,
    HasPermissionDirective,
  ],
  templateUrl: './sector-detail.component.html',
})
export class SectorDetailComponent implements OnInit {
  private readonly service = inject(OrganizationCatalogService);
  private readonly notifications = inject(NotificationService);
  private readonly store = inject(AuthStore);

  readonly sectorGuid = input.required<string>();

  protected readonly sector = signal<SectorResponse | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly units = signal<HospitalUnitResponse[]>([]);

  protected readonly servedUnitForm = new FormGroup({
    unitGuid: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    startDate: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
  });

  ngOnInit(): void {
    this.reload();
  }

  private reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.service.getSector(this.sectorGuid()).subscribe({
      next: (data) => {
        this.sector.set(data);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.sector.set(null);
        this.error.set(toApiError(err).message);
      },
    });
  }

  protected toggleStatus(): void {
    const current = this.sector();
    if (!current || this.busy()) {
      return;
    }
    this.busy.set(true);
    this.service.changeSectorStatus(current.guid, { active: !current.active }).subscribe({
      next: (updated) => {
        this.sector.set(updated);
        this.busy.set(false);
        this.notifications.success(updated.active ? 'Setor reativado.' : 'Setor inativado.');
      },
      error: (err: unknown) => this.fail(err),
    });
  }

  protected loadUnits(): void {
    if (this.units().length > 0 || !this.store.hasPermission('FUNCIONARIO_VISUALIZAR')) {
      return;
    }
    this.service
      .listHospitalUnits({ active: true, page: 1, pageSize: 100 })
      .subscribe({ next: (r) => this.units.set(r.items), error: () => undefined });
  }

  protected addServedUnit(): void {
    const current = this.sector();
    if (!current || this.servedUnitForm.invalid || this.busy()) {
      this.servedUnitForm.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    this.service.addSectorServedUnit(current.guid, this.servedUnitForm.getRawValue()).subscribe({
      next: () => {
        this.servedUnitForm.reset({ unitGuid: '', startDate: '' });
        this.busy.set(false);
        this.notifications.success('Unidade atendida vinculada.');
        this.reload();
      },
      error: (err: unknown) => this.fail(err),
    });
  }

  protected endServedUnit(relationshipGuid: string): void {
    const current = this.sector();
    if (!current || this.busy()) {
      return;
    }
    const endDate = this.promptEndDate();
    if (!endDate) {
      return;
    }
    this.busy.set(true);
    this.service.endSectorServedUnit(current.guid, relationshipGuid, { endDate }).subscribe({
      next: () => {
        this.busy.set(false);
        this.notifications.success('Atendimento à unidade encerrado.');
        this.reload();
      },
      error: (err: unknown) => this.fail(err),
    });
  }

  private promptEndDate(): string | null {
    const today = new Date().toISOString().slice(0, 10);
    const value = window.prompt('Data de encerramento (AAAA-MM-DD):', today);
    if (!value) {
      return null;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      this.notifications.warning('Informe a data no formato AAAA-MM-DD.');
      return null;
    }
    return value;
  }

  private fail(err: unknown): void {
    this.busy.set(false);
    const parsed = toApiError(err);
    this.notifications.error(describeFieldErrors(parsed.fieldErrors) ?? parsed.message);
  }
}
