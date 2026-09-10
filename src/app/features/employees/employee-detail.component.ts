import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthStore } from '../../core/auth/auth-store';
import { describeFieldErrors, toApiError } from '../../core/http/api-error';
import { EmployeeResponse } from '../../core/models/employee.models';
import { HospitalUnitResponse, SectorSummaryResponse } from '../../core/models/organization.models';
import { NotificationService } from '../../core/notifications/notification.service';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';
import { HasPermissionDirective } from '../../shared/directives/has-permission.directive';
import { DateOnlyPipe } from '../../shared/pipes/date-only.pipe';
import { OrganizationCatalogService } from '../organization/organization-catalog.service';
import { EmployeesService } from './employees.service';

@Component({
  selector: 'app-employee-detail',
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
  templateUrl: './employee-detail.component.html',
})
export class EmployeeDetailComponent implements OnInit {
  private readonly service = inject(EmployeesService);
  private readonly catalog = inject(OrganizationCatalogService);
  private readonly notifications = inject(NotificationService);
  private readonly store = inject(AuthStore);

  /** Bound from the route via withComponentInputBinding(). */
  readonly employeeGuid = input.required<string>();

  protected readonly employee = signal<EmployeeResponse | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);

  protected readonly canViewSectors = computed(() => this.store.hasPermission('SETOR_VISUALIZAR'));
  protected readonly units = signal<HospitalUnitResponse[]>([]);
  protected readonly sectors = signal<SectorSummaryResponse[]>([]);

  protected readonly actingUnitForm = new FormGroup({
    unitGuid: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    startDate: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
  });
  protected readonly sectorForm = new FormGroup({
    sectorGuid: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    startDate: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
  });

  ngOnInit(): void {
    this.reload();
  }

  private reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.service.get(this.employeeGuid()).subscribe({
      next: (data) => {
        this.employee.set(data);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.employee.set(null);
        this.error.set(toApiError(err).message);
      },
    });
  }

  protected toggleStatus(): void {
    const current = this.employee();
    if (!current || this.busy()) {
      return;
    }
    this.busy.set(true);
    this.service.changeStatus(current.guid, { active: !current.active }).subscribe({
      next: (updated) => {
        this.employee.set(updated);
        this.busy.set(false);
        this.notifications.success(
          updated.active ? 'Funcionário reativado.' : 'Funcionário inativado.',
        );
      },
      error: (err: unknown) => this.fail(err),
    });
  }

  protected loadRelationshipCatalogs(): void {
    if (this.units().length === 0) {
      this.catalog
        .listHospitalUnits({ active: true, page: 1, pageSize: 100 })
        .subscribe({ next: (r) => this.units.set(r.items), error: () => undefined });
    }
    if (this.canViewSectors() && this.sectors().length === 0) {
      this.catalog
        .listSectors({ active: true, page: 1, pageSize: 100 })
        .subscribe({ next: (r) => this.sectors.set(r.items), error: () => undefined });
    }
  }

  protected addActingUnit(): void {
    const current = this.employee();
    if (!current || this.actingUnitForm.invalid || this.busy()) {
      this.actingUnitForm.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    this.service.addActingUnit(current.guid, this.actingUnitForm.getRawValue()).subscribe({
      next: () => {
        this.actingUnitForm.reset({ unitGuid: '', startDate: '' });
        this.busy.set(false);
        this.notifications.success('Unidade de atuação vinculada.');
        this.reload();
      },
      error: (err: unknown) => this.fail(err),
    });
  }

  protected endActingUnit(relationshipGuid: string): void {
    const current = this.employee();
    if (!current || this.busy()) {
      return;
    }
    const endDate = this.promptEndDate();
    if (!endDate) {
      return;
    }
    this.busy.set(true);
    this.service.endActingUnit(current.guid, relationshipGuid, { endDate }).subscribe({
      next: () => {
        this.busy.set(false);
        this.notifications.success('Atuação em unidade encerrada.');
        this.reload();
      },
      error: (err: unknown) => this.fail(err),
    });
  }

  protected addSector(): void {
    const current = this.employee();
    if (!current || this.sectorForm.invalid || this.busy()) {
      this.sectorForm.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    this.service.addSector(current.guid, this.sectorForm.getRawValue()).subscribe({
      next: () => {
        this.sectorForm.reset({ sectorGuid: '', startDate: '' });
        this.busy.set(false);
        this.notifications.success('Setor vinculado.');
        this.reload();
      },
      error: (err: unknown) => this.fail(err),
    });
  }

  protected endSector(relationshipGuid: string): void {
    const current = this.employee();
    if (!current || this.busy()) {
      return;
    }
    const endDate = this.promptEndDate();
    if (!endDate) {
      return;
    }
    this.busy.set(true);
    this.service.endSector(current.guid, relationshipGuid, { endDate }).subscribe({
      next: () => {
        this.busy.set(false);
        this.notifications.success('Atuação em setor encerrada.');
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
