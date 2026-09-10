import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormArray, FormControl, FormGroup } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthStore } from '../../core/auth/auth-store';
import { CurrentUserResponse } from '../../core/models/auth.models';
import { NotificationService } from '../../core/notifications/notification.service';
import { EmployeesService } from '../employees/employees.service';
import { SectorFormComponent } from './sector-form.component';
import { OrganizationCatalogService } from './organization-catalog.service';

/**
 * The template-facing members are `protected`; the spec reaches them through a
 * narrow structural view so it can drive the same rules the backend validator
 * enforces on `POST /api/setores` (task section 3).
 */
interface FormInternals {
  form: FormGroup<{
    unitGuid: FormControl<string>;
    categoryGuid: FormControl<string>;
    name: FormControl<string>;
    sigla: FormControl<string>;
    allowsSharedActing: FormControl<boolean>;
  }>;
  servedUnits: FormArray;
  maxServedUnits: number;
  submit(): void;
  addServedUnitRow(): void;
  optionsForRow(index: number): { guid: string; name: string }[];
}

function identity(permissions: string[]): CurrentUserResponse {
  return {
    userGuid: '1',
    email: 'u@h.test',
    active: true,
    permissionVersion: 1,
    employee: null,
    organization: null,
    hiringUnit: null,
    permissions,
  };
}

const UNITS = [
  { guid: 'u-a', name: 'Unidade A' },
  { guid: 'u-b', name: 'Unidade B' },
  { guid: 'u-c', name: 'Unidade C' },
];

function page<T>(items: T[]) {
  return of({ items, page: 1, pageSize: 100, total: items.length });
}

describe('SectorFormComponent — served-unit UX rules (create flow)', () => {
  let fixture: ComponentFixture<SectorFormComponent>;
  let c: FormInternals;
  let createSector: jasmine.Spy;
  let notifications: NotificationService;

  beforeEach(() => {
    createSector = jasmine.createSpy('createSector').and.returnValue(of({ guid: 'new-sector' }));

    const catalog: Partial<OrganizationCatalogService> = {
      listHospitalUnits: () => page(UNITS) as never,
      listSectorCategories: () => page([{ guid: 'c-1', name: 'Assistencial' }]) as never,
      createSector: createSector as never,
      updateSector: jasmine.createSpy('updateSector').and.returnValue(of({ guid: 'x' })) as never,
    };
    const employees: Partial<EmployeesService> = { list: () => page([]) as never };

    TestBed.configureTestingModule({
      imports: [SectorFormComponent],
      providers: [
        provideRouter([]),
        { provide: OrganizationCatalogService, useValue: catalog },
        { provide: EmployeesService, useValue: employees },
      ],
    });

    TestBed.inject(AuthStore).setIdentity(
      identity(['SETOR_CRIAR', 'FUNCIONARIO_VISUALIZAR', 'CATEGORIA_SETOR_VISUALIZAR']),
    );
    notifications = TestBed.inject(NotificationService);

    fixture = TestBed.createComponent(SectorFormComponent);
    c = fixture.componentInstance as unknown as FormInternals;
    fixture.detectChanges(); // runs ngOnInit + resolves the forkJoin
  });

  function fillMainFields(): void {
    c.form.patchValue({
      unitGuid: 'u-a',
      categoryGuid: 'c-1',
      name: 'Farmácia Central',
      sigla: 'FC',
    });
  }

  function enableShared(): void {
    c.form.controls.allowsSharedActing.setValue(true);
  }

  it('excludes the principal unit from served-unit row options', () => {
    fillMainFields();
    enableShared();
    c.addServedUnitRow();

    const options = c.optionsForRow(0).map((u) => u.guid);
    expect(options).not.toContain('u-a');
    expect(options).toEqual(jasmine.arrayContaining(['u-b', 'u-c']));
  });

  it('drops a unit already chosen in another row from the remaining rows', () => {
    fillMainFields();
    enableShared();
    c.addServedUnitRow();
    c.addServedUnitRow();
    c.servedUnits.at(0).patchValue({ unitGuid: 'u-b' });

    expect(c.optionsForRow(1).map((u) => u.guid)).not.toContain('u-b');
    // the row that owns the selection still lists it
    expect(c.optionsForRow(0).map((u) => u.guid)).toContain('u-b');
  });

  it('flags the principal unit used as a served unit and blocks submit', () => {
    fillMainFields();
    enableShared();
    c.addServedUnitRow();
    c.servedUnits.at(0).patchValue({ unitGuid: 'u-a', startDate: '2026-01-02' });

    c.submit();

    expect(c.servedUnits.errors?.['principalAsServed']).toBeTrue();
    expect(createSector).not.toHaveBeenCalled();
  });

  it('flags a repeated served unit and blocks submit', () => {
    fillMainFields();
    enableShared();
    c.addServedUnitRow();
    c.addServedUnitRow();
    c.servedUnits.at(0).patchValue({ unitGuid: 'u-b', startDate: '2026-01-02' });
    c.servedUnits.at(1).patchValue({ unitGuid: 'u-b', startDate: '2026-01-03' });

    c.submit();

    expect(c.servedUnits.errors?.['duplicateServed']).toBeTrue();
    expect(createSector).not.toHaveBeenCalled();
  });

  it('does not submit while a dynamic row is missing its unit', () => {
    const spy = spyOn(notifications, 'error');
    fillMainFields();
    enableShared();
    c.addServedUnitRow();
    c.servedUnits.at(0).patchValue({ startDate: '2026-01-02' });

    c.submit();

    expect(createSector).not.toHaveBeenCalled();
    expect(spy).toHaveBeenCalled();
  });

  it('does not submit while a dynamic row is missing its start date', () => {
    fillMainFields();
    enableShared();
    c.addServedUnitRow();
    c.servedUnits.at(0).patchValue({ unitGuid: 'u-b' });

    c.submit();

    expect(createSector).not.toHaveBeenCalled();
  });

  it('submits servedUnits: null when shared acting is disabled, discarding stale rows', () => {
    fillMainFields();
    enableShared();
    c.addServedUnitRow();
    c.servedUnits.at(0).patchValue({ unitGuid: 'u-b', startDate: '2026-01-02' });

    // user changes their mind
    c.form.controls.allowsSharedActing.setValue(false);
    expect(c.servedUnits.length).toBe(0);

    c.submit();

    expect(createSector).toHaveBeenCalledTimes(1);
    expect(createSector.calls.mostRecent().args[0].servedUnits).toBeNull();
  });

  it('submits the rows when shared acting stays enabled and every row is valid', () => {
    fillMainFields();
    enableShared();
    c.addServedUnitRow();
    c.servedUnits.at(0).patchValue({ unitGuid: 'u-b', startDate: '2026-01-02' });

    c.submit();

    expect(createSector).toHaveBeenCalledTimes(1);
    const body = createSector.calls.mostRecent().args[0];
    expect(body.servedUnits).toEqual([{ unitGuid: 'u-b', startDate: '2026-01-02' }]);
  });

  it('never adds more than 50 served-unit rows (backend limit)', () => {
    enableShared();
    for (let i = 0; i < 55; i++) {
      c.addServedUnitRow();
    }
    expect(c.servedUnits.length).toBe(50);
    expect(c.maxServedUnits).toBe(50);
  });
});
