import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import {
  FormArray,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { AuthStore } from '../../core/auth/auth-store';
import { describeFieldErrors, toApiError } from '../../core/http/api-error';
import { EmployeeSummaryResponse } from '../../core/models/employee.models';
import {
  CreateSectorRequest,
  HospitalUnitResponse,
  SectorCategoryResponse,
  SectorResponse,
  UpdateSectorRequest,
} from '../../core/models/organization.models';
import { NotificationService } from '../../core/notifications/notification.service';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';
import { EmployeesService } from '../employees/employees.service';
import { OrganizationCatalogService } from './organization-catalog.service';

/** Upper limit for the initial served-unit rows (mirrors the backend validator). */
const MAX_SERVED_UNITS = 50;

@Component({
  selector: 'app-sector-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, StatusBadgeComponent],
  templateUrl: './sector-form.component.html',
})
export class SectorFormComponent implements OnInit {
  private readonly service = inject(OrganizationCatalogService);
  private readonly employees = inject(EmployeesService);
  private readonly notifications = inject(NotificationService);
  private readonly store = inject(AuthStore);
  private readonly router = inject(Router);

  readonly sectorGuid = input<string>();

  protected readonly maxServedUnits = MAX_SERVED_UNITS;
  protected readonly isEdit = computed(() => !!this.sectorGuid());
  protected readonly canEdit = computed(() => this.store.hasPermission('SETOR_EDITAR'));

  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly active = signal(true);
  protected readonly principalUnitName = signal<string>('');

  protected readonly units = signal<HospitalUnitResponse[]>([]);
  protected readonly categories = signal<SectorCategoryResponse[]>([]);
  protected readonly staff = signal<EmployeeSummaryResponse[]>([]);

  protected readonly canUnits = computed(() => this.store.hasPermission('FUNCIONARIO_VISUALIZAR'));
  protected readonly canCategories = computed(() =>
    this.store.hasPermission('CATEGORIA_SETOR_VISUALIZAR'),
  );

  /** Blocking gaps for the current operation → disable submit. */
  protected readonly missingCatalogs = computed(() => {
    const missing: string[] = [];
    if (!this.canCategories()) missing.push('CATEGORIA_SETOR_VISUALIZAR (categorias)');
    if (!this.isEdit() && !this.canUnits()) missing.push('FUNCIONARIO_VISUALIZAR (unidades)');
    return missing;
  });

  protected readonly form = new FormGroup({
    unitGuid: new FormControl('', { nonNullable: true }),
    categoryGuid: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(150)],
    }),
    sigla: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(20)],
    }),
    description: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(1000)] }),
    internalLocation: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(150)],
    }),
    extension: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(30)] }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.email, Validators.maxLength(254)],
    }),
    responsibleEmployeeGuid: new FormControl('', { nonNullable: true }),
    careRelated: new FormControl(false, { nonNullable: true }),
    allowsScheduleAllocation: new FormControl(false, { nonNullable: true }),
    allowsSharedActing: new FormControl(false, { nonNullable: true }),
    servedUnits: new FormArray<
      FormGroup<{ unitGuid: FormControl<string>; startDate: FormControl<string> }>
    >([]),
  });

  get servedUnits(): FormArray {
    return this.form.controls.servedUnits;
  }

  ngOnInit(): void {
    if (!this.isEdit()) {
      this.form.controls.unitGuid.addValidators(Validators.required);
    } else {
      this.form.controls.unitGuid.disable();
    }

    const requests = {
      units: this.canUnits()
        ? this.service.listHospitalUnits({ active: true, page: 1, pageSize: 100 })
        : of(null),
      categories: this.canCategories()
        ? this.service.listSectorCategories({ active: true, page: 1, pageSize: 100 })
        : of(null),
      staff: this.canUnits()
        ? this.employees.list({ active: true, page: 1, pageSize: 100 })
        : of(null),
    };

    forkJoin(requests).subscribe({
      next: (result) => {
        if (result.units) this.units.set(result.units.items);
        if (result.categories) this.categories.set(result.categories.items);
        if (result.staff) this.staff.set(result.staff.items);
        if (this.isEdit()) {
          this.loadSector();
        } else {
          this.loading.set(false);
        }
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.loadError.set(toApiError(err).message);
      },
    });
  }

  private loadSector(): void {
    const guid = this.sectorGuid();
    if (!guid) {
      this.loading.set(false);
      return;
    }
    this.service.getSector(guid).subscribe({
      next: (sector: SectorResponse) => {
        this.active.set(sector.active);
        this.principalUnitName.set(sector.unit.name);
        this.form.patchValue({
          unitGuid: sector.unit.guid,
          categoryGuid: sector.category.guid,
          name: sector.name,
          sigla: sector.sigla,
          description: sector.description ?? '',
          internalLocation: sector.internalLocation ?? '',
          extension: sector.extension ?? '',
          email: sector.email ?? '',
          responsibleEmployeeGuid: sector.responsible?.guid ?? '',
          careRelated: sector.careRelated,
          allowsScheduleAllocation: sector.allowsScheduleAllocation,
          allowsSharedActing: sector.allowsSharedActing,
        });
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.loadError.set(toApiError(err).message);
      },
    });
  }

  protected invalid(control: 'name' | 'sigla' | 'categoryGuid' | 'unitGuid' | 'email'): boolean {
    const ctrl = this.form.controls[control];
    return ctrl.invalid && (ctrl.touched || ctrl.dirty);
  }

  protected addServedUnitRow(): void {
    if (this.servedUnits.length >= this.maxServedUnits) {
      return;
    }
    this.servedUnits.push(
      new FormGroup({
        unitGuid: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
        startDate: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      }),
    );
  }

  protected removeServedUnitRow(index: number): void {
    this.servedUnits.removeAt(index);
  }

  protected toggleStatus(): void {
    const guid = this.sectorGuid();
    if (!guid || this.busy()) {
      return;
    }
    this.busy.set(true);
    this.service.changeSectorStatus(guid, { active: !this.active() }).subscribe({
      next: (sector) => {
        this.active.set(sector.active);
        this.busy.set(false);
        this.notifications.success(sector.active ? 'Setor reativado.' : 'Setor inativado.');
      },
      error: (err: unknown) => this.fail(err),
    });
  }

  protected submit(): void {
    if (this.busy() || this.missingCatalogs().length > 0) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    this.busy.set(true);

    if (this.isEdit()) {
      const body: UpdateSectorRequest = {
        categoryGuid: raw.categoryGuid,
        name: raw.name.trim(),
        sigla: raw.sigla.trim().toUpperCase(),
        description: raw.description.trim() || null,
        internalLocation: raw.internalLocation.trim() || null,
        extension: raw.extension.trim() || null,
        email: raw.email.trim() || null,
        responsibleEmployeeGuid: raw.responsibleEmployeeGuid || null,
        careRelated: raw.careRelated,
        allowsScheduleAllocation: raw.allowsScheduleAllocation,
        allowsSharedActing: raw.allowsSharedActing,
      };
      this.service.updateSector(this.sectorGuid()!, body).subscribe({
        next: (updated) => this.done(updated.guid, 'Setor atualizado.'),
        error: (err: unknown) => this.fail(err),
      });
      return;
    }

    const servedUnits = raw.allowsSharedActing && raw.servedUnits.length > 0 ? raw.servedUnits : null;
    const body: CreateSectorRequest = {
      unitGuid: raw.unitGuid,
      categoryGuid: raw.categoryGuid,
      name: raw.name.trim(),
      sigla: raw.sigla.trim().toUpperCase(),
      description: raw.description.trim() || null,
      internalLocation: raw.internalLocation.trim() || null,
      extension: raw.extension.trim() || null,
      email: raw.email.trim() || null,
      responsibleEmployeeGuid: raw.responsibleEmployeeGuid || null,
      careRelated: raw.careRelated,
      allowsScheduleAllocation: raw.allowsScheduleAllocation,
      allowsSharedActing: raw.allowsSharedActing,
      servedUnits,
    };
    this.service.createSector(body).subscribe({
      next: (created) => this.done(created.guid, 'Setor cadastrado.'),
      error: (err: unknown) => this.fail(err),
    });
  }

  private done(guid: string, message: string): void {
    this.busy.set(false);
    this.notifications.success(message);
    void this.router.navigate(['/setores', guid]);
  }

  private fail(err: unknown): void {
    this.busy.set(false);
    const parsed = toApiError(err);
    this.notifications.error(describeFieldErrors(parsed.fieldErrors) ?? parsed.message);
  }
}
