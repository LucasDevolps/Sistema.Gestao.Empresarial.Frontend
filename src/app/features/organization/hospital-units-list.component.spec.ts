import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthStore } from '../../core/auth/auth-store';
import { CurrentUserResponse } from '../../core/models/auth.models';
import { HospitalUnitSummaryResponse } from '../../core/models/organization.models';
import { HospitalUnitsListComponent } from './hospital-units-list.component';
import { fullUnit } from './hospital-unit-form.model.spec';
import { OrganizationCatalogService } from './organization-catalog.service';

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

const ROW: HospitalUnitSummaryResponse = {
  guid: 'unit-1',
  name: 'Hospital Central',
  active: true,
  organization: { guid: 'org-1', name: 'Rede Saúde' },
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  legalName: 'Hospital Central Ltda',
  cnpj: '11222333000181',
  cnes: '1234567',
  city: 'São Paulo',
  state: 'SP',
};

describe('HospitalUnitsListComponent', () => {
  let fixture: ComponentFixture<HospitalUnitsListComponent>;
  let service: jasmine.SpyObj<OrganizationCatalogService>;

  function setup(permissions: string[]): void {
    service = jasmine.createSpyObj<OrganizationCatalogService>('svc', [
      'listHospitalUnits',
      'changeHospitalUnitStatus',
      'getHospitalUnit',
    ]);
    service.listHospitalUnits.and.returnValue(of({ items: [ROW], page: 1, pageSize: 20, total: 1 }));
    service.changeHospitalUnitStatus.and.callFake((_guid, body) =>
      of(fullUnit({ active: body.active })),
    );
    TestBed.configureTestingModule({
      imports: [HospitalUnitsListComponent],
      providers: [provideRouter([]), { provide: OrganizationCatalogService, useValue: service }],
    });
    TestBed.inject(AuthStore).setIdentity(identity(permissions));
    fixture = TestBed.createComponent(HospitalUnitsListComponent);
    fixture.detectChanges();
  }

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function byText(selector: string, label: string): HTMLElement | undefined {
    return Array.from(root().querySelectorAll<HTMLElement>(selector)).find(
      (e) => e.textContent?.trim() === label,
    );
  }

  it('renders the summary columns from a single list request (no detail GET per row)', () => {
    setup(['UNIDADE_HOSPITALAR_VISUALIZAR']);
    const row = root().querySelector('tbody tr')!.textContent ?? '';
    expect(row).toContain('Hospital Central');
    expect(row).toContain('Hospital Central Ltda');
    expect(row).toContain('11.222.333/0001-81');
    expect(row).toContain('1234567');
    expect(row).toContain('São Paulo/SP');
    expect(row).toContain('Rede Saúde');
    expect(row).toContain('Ativa');
    expect(service.listHospitalUnits).toHaveBeenCalledTimes(1);
    expect(service.getHospitalUnit).not.toHaveBeenCalled();
  });

  it('sends the filters with their real names, unmasked, after a debounce', fakeAsync(() => {
    setup(['UNIDADE_HOSPITALAR_VISUALIZAR']);
    const component = fixture.componentInstance as unknown as {
      filters: { patchValue(v: Record<string, string>): void };
    };
    component.filters.patchValue({
      search: ' Central ',
      legalName: 'Ltda',
      cnpj: '11.222.333/0001-81',
      cnes: '1234567',
      city: 'São Paulo',
      state: 'SP',
      active: 'false',
    });
    tick(100);
    expect(service.listHospitalUnits).toHaveBeenCalledTimes(1); // still debouncing
    tick(400);
    expect(service.listHospitalUnits).toHaveBeenCalledTimes(2);
    expect(service.listHospitalUnits.calls.mostRecent().args[0]).toEqual({
      search: 'Central',
      legalName: 'Ltda',
      cnpj: '11222333000181',
      cnes: '1234567',
      city: 'São Paulo',
      state: 'SP',
      active: false,
      page: 1,
      pageSize: 20,
    });
  }));

  it('keeps working after a failed request (the reload stream survives errors)', fakeAsync(() => {
    setup(['UNIDADE_HOSPITALAR_VISUALIZAR']);
    service.listHospitalUnits.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 503 })),
    );
    const component = fixture.componentInstance as unknown as {
      filters: { patchValue(v: Record<string, string>): void };
    };
    component.filters.patchValue({ search: 'a' });
    tick(400);
    fixture.detectChanges();
    expect(root().querySelector('[role="alert"]')?.textContent).toContain('indisponível');

    service.listHospitalUnits.and.returnValue(of({ items: [ROW], page: 1, pageSize: 20, total: 1 }));
    component.filters.patchValue({ search: 'b' });
    tick(400);
    fixture.detectChanges();
    expect(service.listHospitalUnits).toHaveBeenCalledTimes(3);
    expect(root().querySelector('tbody')?.textContent).toContain('Hospital Central');
  }));

  it('a read-only user sees only "Visualizar" — no "Nova unidade", "Editar" or status action', () => {
    setup(['UNIDADE_HOSPITALAR_VISUALIZAR']);
    expect(byText('a', 'Nova unidade')).toBeUndefined();
    expect(byText('a', 'Visualizar')).toBeDefined();
    expect(byText('a', 'Editar')).toBeUndefined();
    expect(byText('button', 'Inativar')).toBeUndefined();
  });

  it('shows "Nova unidade" with UNIDADE_HOSPITALAR_CRIAR', () => {
    setup(['UNIDADE_HOSPITALAR_VISUALIZAR', 'UNIDADE_HOSPITALAR_CRIAR']);
    expect(byText('a', 'Nova unidade')).toBeDefined();
    expect(byText('a', 'Editar')).toBeUndefined();
  });

  it('shows "Editar" and the status action with UNIDADE_HOSPITALAR_EDITAR', () => {
    setup(['UNIDADE_HOSPITALAR_VISUALIZAR', 'UNIDADE_HOSPITALAR_EDITAR']);
    expect(byText('a', 'Editar')).toBeDefined();
    expect(byText('button', 'Inativar')).toBeDefined();
    expect(byText('a', 'Nova unidade')).toBeUndefined();
  });

  it('confirms before inactivating a row and updates it in place', () => {
    setup(['UNIDADE_HOSPITALAR_VISUALIZAR', 'UNIDADE_HOSPITALAR_EDITAR']);
    byText('button', 'Inativar')!.click();
    fixture.detectChanges();
    const dialog = root().querySelector('dialog')!;
    expect(dialog.open).toBeTrue();
    expect(service.changeHospitalUnitStatus).not.toHaveBeenCalled();

    (dialog.querySelector('.btn--danger') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(service.changeHospitalUnitStatus).toHaveBeenCalledOnceWith('unit-1', { active: false });
    expect(root().querySelector('tbody tr')?.textContent).toContain('Inativa');
    expect(byText('button', 'Reativar')).toBeDefined();
  });
});
