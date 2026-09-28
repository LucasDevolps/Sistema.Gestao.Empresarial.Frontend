import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthStore } from '../../core/auth/auth-store';
import { CurrentUserResponse } from '../../core/models/auth.models';
import { ProfessionalLevelResponse } from '../../core/models/catalog.models';
import { EmployeeResponse } from '../../core/models/employee.models';
import { ProfessionalCatalogService } from '../catalogs/professional-catalog.service';
import { OrganizationCatalogService } from '../organization/organization-catalog.service';
import { EmployeeFormComponent } from './employee-form.component';
import { EmployeesService } from './employees.service';

/**
 * Regression for issue #47: professional levels became a paginated, manageable
 * catalog. The employee form must keep filling its level dropdown from the
 * envelope (active levels only) and keep showing the employee's current level.
 */
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

function level(guid: string, code: string, name: string, order: number): ProfessionalLevelResponse {
  return {
    guid,
    code,
    name,
    order,
    active: true,
    createdAt: '2026-09-27T12:00:00Z',
    updatedAt: '2026-09-27T12:00:00Z',
  };
}

function page<T>(items: T[]) {
  return of({ items, page: 1, pageSize: 100, total: items.length });
}

describe('EmployeeFormComponent — professional level dropdown', () => {
  let fixture: ComponentFixture<EmployeeFormComponent>;
  let listLevels: jasmine.Spy;

  beforeEach(() => {
    listLevels = jasmine
      .createSpy('listLevels')
      .and.returnValue(page([level('lvl-jr', 'JR', 'Júnior', 1), level('lvl-esp', 'ESP', 'Especialista', 4)]));
    const catalogs: Partial<ProfessionalCatalogService> = {
      listProfessions: () => page([{ guid: 'p-1', name: 'Enfermagem' }]) as never,
      listPositions: () => page([{ guid: 'c-1', name: 'Enfermeiro' }]) as never,
      listLevels: listLevels as never,
    };
    const orgCatalog: Partial<OrganizationCatalogService> = {
      listHospitalUnits: () => page([]) as never,
      listSectors: () => page([]) as never,
    };
    const employees: Partial<EmployeesService> = {
      get: () =>
        of({
          guid: 'emp-1',
          name: 'Maria',
          email: 'maria@hospital.test',
          phone: null,
          profession: { guid: 'p-1', name: 'Enfermagem' },
          position: { guid: 'c-1', name: 'Enfermeiro' },
          level: { guid: 'lvl-esp', code: 'ESP', name: 'Especialista' },
        } as unknown as EmployeeResponse),
    };
    TestBed.configureTestingModule({
      imports: [EmployeeFormComponent],
      providers: [
        provideRouter([]),
        { provide: ProfessionalCatalogService, useValue: catalogs },
        { provide: OrganizationCatalogService, useValue: orgCatalog },
        { provide: EmployeesService, useValue: employees },
      ],
    });
    TestBed.inject(AuthStore).setIdentity(
      identity([
        'FUNCIONARIO_VISUALIZAR',
        'FUNCIONARIO_EDITAR',
        'PROFISSAO_VISUALIZAR',
        'CARGO_VISUALIZAR',
        'NIVEL_PROFISSIONAL_VISUALIZAR',
      ]),
    );
    fixture = TestBed.createComponent(EmployeeFormComponent);
  });

  function levelOptions(): string[] {
    const select = (fixture.nativeElement as HTMLElement).querySelector('#level') as HTMLSelectElement;
    return Array.from(select.options).map((o) => o.textContent?.trim() ?? '');
  }

  it('requests only active levels through the paginated contract and lists them', () => {
    fixture.detectChanges();

    expect(listLevels).toHaveBeenCalledOnceWith({ active: true, page: 1, pageSize: 100 });
    expect(levelOptions()).toEqual(['Selecione…', 'JR · Júnior', 'ESP · Especialista']);
  });

  it("keeps the employee's current level selected when editing", async () => {
    fixture.componentRef.setInput('employeeGuid', 'emp-1');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const select = (fixture.nativeElement as HTMLElement).querySelector('#level') as HTMLSelectElement;
    expect(select.value).toBe('lvl-esp');
  });
});
