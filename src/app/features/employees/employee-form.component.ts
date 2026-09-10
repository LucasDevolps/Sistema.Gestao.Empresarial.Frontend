import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
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
import {
  CreateEmployeeRequest,
  EMPLOYEE_RELATIONSHIP_MAX_ITEMS,
  EmployeeResponse,
  UpdateEmployeeRequest,
} from '../../core/models/employee.models';
import { PositionResponse, ProfessionResponse, ProfessionalLevelResponse } from '../../core/models/catalog.models';
import { HospitalUnitResponse, SectorSummaryResponse } from '../../core/models/organization.models';
import { NotificationService } from '../../core/notifications/notification.service';
import { ProfessionalCatalogService } from '../catalogs/professional-catalog.service';
import { OrganizationCatalogService } from '../organization/organization-catalog.service';
import { EmployeesService } from './employees.service';

@Component({
  selector: 'app-employee-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './employee-form.component.html',
})
export class EmployeeFormComponent implements OnInit {
  private readonly employees = inject(EmployeesService);
  private readonly catalogs = inject(ProfessionalCatalogService);
  private readonly orgCatalog = inject(OrganizationCatalogService);
  private readonly notifications = inject(NotificationService);
  private readonly store = inject(AuthStore);
  private readonly router = inject(Router);

  readonly employeeGuid = input<string>();

  protected readonly isEdit = computed(() => !!this.employeeGuid());
  protected readonly maxItems = EMPLOYEE_RELATIONSHIP_MAX_ITEMS;

  protected readonly loading = signal(true);
  protected readonly submitting = signal(false);
  protected readonly loadError = signal<string | null>(null);

  protected readonly professions = signal<ProfessionResponse[]>([]);
  protected readonly positions = signal<PositionResponse[]>([]);
  protected readonly levels = signal<ProfessionalLevelResponse[]>([]);
  protected readonly units = signal<HospitalUnitResponse[]>([]);
  protected readonly sectors = signal<SectorSummaryResponse[]>([]);

  protected readonly canProfessions = computed(() => this.store.hasPermission('PROFISSAO_VISUALIZAR'));
  protected readonly canPositions = computed(() => this.store.hasPermission('CARGO_VISUALIZAR'));
  protected readonly canLevels = computed(() => this.store.hasPermission('NIVEL_PROFISSIONAL_VISUALIZAR'));
  protected readonly canUnits = computed(() => this.store.hasPermission('FUNCIONARIO_VISUALIZAR'));
  protected readonly canSectors = computed(() => this.store.hasPermission('SETOR_VISUALIZAR'));

  /** Required catalogues missing for the current operation → block submit (spec section 28). */
  protected readonly missingCatalogs = computed(() => {
    const missing: string[] = [];
    if (!this.canProfessions()) missing.push('PROFISSAO_VISUALIZAR (profissões)');
    if (!this.canPositions()) missing.push('CARGO_VISUALIZAR (cargos)');
    if (!this.canLevels()) missing.push('NIVEL_PROFISSIONAL_VISUALIZAR (níveis)');
    if (!this.isEdit() && !this.canUnits()) missing.push('FUNCIONARIO_VISUALIZAR (unidades)');
    return missing;
  });

  protected readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(200)] }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email, Validators.maxLength(254)],
    }),
    phone: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(30)] }),
    professionGuid: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    positionGuid: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    levelGuid: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    hiringUnitGuid: new FormControl('', { nonNullable: true }),
    admissionDate: new FormControl('', { nonNullable: true }),
    actingUnits: new FormArray<FormGroup<{ unitGuid: FormControl<string>; startDate: FormControl<string> }>>([]),
    sectors: new FormArray<FormGroup<{ sectorGuid: FormControl<string>; startDate: FormControl<string> }>>([]),
  });

  get actingUnits(): FormArray {
    return this.form.controls.actingUnits;
  }
  get sectorLinks(): FormArray {
    return this.form.controls.sectors;
  }

  ngOnInit(): void {
    if (!this.isEdit()) {
      this.form.controls.hiringUnitGuid.addValidators(Validators.required);
      this.form.controls.admissionDate.addValidators(Validators.required);
    }

    const catalogRequests = {
      professions: this.canProfessions()
        ? this.catalogs.listProfessions({ active: true, page: 1, pageSize: 100 })
        : of(null),
      positions: this.canPositions()
        ? this.catalogs.listPositions({ active: true, page: 1, pageSize: 100 })
        : of(null),
      levels: this.canLevels() ? this.catalogs.listLevels(true) : of(null),
      units: this.canUnits()
        ? this.orgCatalog.listHospitalUnits({ active: true, page: 1, pageSize: 100 })
        : of(null),
      sectors: this.canSectors()
        ? this.orgCatalog.listSectors({ active: true, page: 1, pageSize: 100 })
        : of(null),
    };

    forkJoin(catalogRequests).subscribe({
      next: (result) => {
        if (result.professions) this.professions.set(result.professions.items);
        if (result.positions) this.positions.set(result.positions.items);
        if (result.levels) this.levels.set(result.levels);
        if (result.units) this.units.set(result.units.items);
        if (result.sectors) this.sectors.set(result.sectors.items);
        if (this.isEdit()) {
          this.loadEmployee();
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

  private loadEmployee(): void {
    const guid = this.employeeGuid();
    if (!guid) {
      this.loading.set(false);
      return;
    }
    this.employees.get(guid).subscribe({
      next: (emp: EmployeeResponse) => {
        this.form.patchValue({
          name: emp.name,
          email: emp.email,
          phone: emp.phone ?? '',
          professionGuid: emp.profession.guid,
          positionGuid: emp.position.guid,
          levelGuid: emp.level.guid,
        });
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.loadError.set(toApiError(err).message);
      },
    });
  }

  protected addActingUnitRow(): void {
    if (this.actingUnits.length >= this.maxItems) {
      return;
    }
    this.actingUnits.push(
      new FormGroup({
        unitGuid: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
        startDate: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      }),
    );
  }

  protected removeActingUnitRow(index: number): void {
    this.actingUnits.removeAt(index);
  }

  protected addSectorRow(): void {
    if (this.sectorLinks.length >= this.maxItems) {
      return;
    }
    this.sectorLinks.push(
      new FormGroup({
        sectorGuid: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
        startDate: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      }),
    );
  }

  protected removeSectorRow(index: number): void {
    this.sectorLinks.removeAt(index);
  }

  protected submit(): void {
    if (this.submitting() || this.missingCatalogs().length > 0) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    this.submitting.set(true);

    if (this.isEdit()) {
      const body: UpdateEmployeeRequest = {
        name: raw.name.trim(),
        email: raw.email.trim(),
        phone: raw.phone.trim() || null,
        professionGuid: raw.professionGuid,
        positionGuid: raw.positionGuid,
        levelGuid: raw.levelGuid,
      };
      this.employees.update(this.employeeGuid()!, body).subscribe({
        next: (updated) => this.done(updated.guid, 'Funcionário atualizado.'),
        error: (err: unknown) => this.fail(err),
      });
      return;
    }

    const body: CreateEmployeeRequest = {
      name: raw.name.trim(),
      email: raw.email.trim(),
      phone: raw.phone.trim() || null,
      professionGuid: raw.professionGuid,
      positionGuid: raw.positionGuid,
      levelGuid: raw.levelGuid,
      hiringUnitGuid: raw.hiringUnitGuid,
      admissionDate: raw.admissionDate,
      actingUnits: raw.actingUnits.length > 0 ? raw.actingUnits : null,
      sectors: raw.sectors.length > 0 ? raw.sectors : null,
    };
    this.employees.create(body).subscribe({
      next: (created) => this.done(created.guid, 'Funcionário cadastrado.'),
      error: (err: unknown) => this.fail(err),
    });
  }

  private done(guid: string, message: string): void {
    this.submitting.set(false);
    this.notifications.success(message);
    void this.router.navigate(['/funcionarios', guid]);
  }

  private fail(err: unknown): void {
    this.submitting.set(false);
    const parsed = toApiError(err);
    this.notifications.error(describeFieldErrors(parsed.fieldErrors) ?? parsed.message);
  }
}
