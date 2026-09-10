import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthStore } from '../../core/auth/auth-store';
import { CurrentUserResponse } from '../../core/models/auth.models';
import { SectorSummaryResponse } from '../../core/models/organization.models';
import { SectorsListComponent } from './sectors-list.component';
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

const ROW: SectorSummaryResponse = {
  guid: 's-1',
  sigla: 'FC',
  name: 'Farmácia',
  active: true,
  careRelated: false,
  allowsScheduleAllocation: false,
  allowsSharedActing: false,
  unit: { guid: 'u-1', name: 'Unidade' },
  category: { guid: 'c-1', name: 'Categoria' },
};

describe('SectorsListComponent — entry controls match the route guards', () => {
  let fixture: ComponentFixture<SectorsListComponent>;
  let store: AuthStore;

  beforeEach(() => {
    const rows = of({ items: [ROW], page: 1, pageSize: 20, total: 1 });
    const catalog: Partial<OrganizationCatalogService> = {
      listSectors: () => rows as never,
      listHospitalUnits: () => of({ items: [], page: 1, pageSize: 20, total: 0 }) as never,
      listSectorCategories: () => of({ items: [], page: 1, pageSize: 20, total: 0 }) as never,
    };
    TestBed.configureTestingModule({
      imports: [SectorsListComponent],
      providers: [provideRouter([]), { provide: OrganizationCatalogService, useValue: catalog }],
    });
    store = TestBed.inject(AuthStore);
    fixture = TestBed.createComponent(SectorsListComponent);
  });

  function linkTexts(): string[] {
    return Array.from(fixture.nativeElement.querySelectorAll('a')).map((a) =>
      (a as HTMLElement).textContent?.trim(),
    ) as string[];
  }

  it('hides "Novo setor" without the catalog read permissions', () => {
    store.setIdentity(identity(['SETOR_VISUALIZAR', 'SETOR_CRIAR']));
    fixture.detectChanges();
    expect(linkTexts()).not.toContain('Novo setor');
  });

  it('shows "Novo setor" only with the full create capability', () => {
    store.setIdentity(
      identity(['SETOR_VISUALIZAR', 'SETOR_CRIAR', 'FUNCIONARIO_VISUALIZAR', 'CATEGORIA_SETOR_VISUALIZAR']),
    );
    fixture.detectChanges();
    expect(linkTexts()).toContain('Novo setor');
  });

  it('hides the row "Editar" link without CATEGORIA_SETOR_VISUALIZAR', () => {
    store.setIdentity(identity(['SETOR_VISUALIZAR', 'SETOR_EDITAR']));
    fixture.detectChanges();
    expect(linkTexts()).not.toContain('Editar');
  });

  it('shows the row "Editar" link with the full edit capability', () => {
    store.setIdentity(identity(['SETOR_VISUALIZAR', 'SETOR_EDITAR', 'CATEGORIA_SETOR_VISUALIZAR']));
    fixture.detectChanges();
    expect(linkTexts()).toContain('Editar');
  });
});
