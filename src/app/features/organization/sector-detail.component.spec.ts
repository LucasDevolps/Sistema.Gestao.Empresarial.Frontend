import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, FormGroup } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthStore } from '../../core/auth/auth-store';
import { CurrentUserResponse } from '../../core/models/auth.models';
import { NotificationService } from '../../core/notifications/notification.service';
import { SectorResponse } from '../../core/models/organization.models';
import { SectorDetailComponent } from './sector-detail.component';
import { OrganizationCatalogService } from './organization-catalog.service';

interface DetailInternals {
  availableUnits(): { guid: string; name: string }[];
  canAddServedUnit(): boolean;
  servedUnitForm: FormGroup<{ unitGuid: FormControl<string>; startDate: FormControl<string> }>;
  addServedUnit(): void;
  endServedUnit(relationshipGuid: string): void;
  loadUnits(): void;
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

function sectorResponse(): SectorResponse {
  return {
    guid: 'sec-1',
    sigla: 'FC',
    name: 'Farmácia Central',
    active: true,
    unit: { guid: 'u-a', name: 'Unidade A' },
    category: { guid: 'c-1', name: 'Assistencial' },
    description: null,
    internalLocation: null,
    extension: null,
    email: null,
    responsible: null,
    careRelated: false,
    allowsScheduleAllocation: false,
    allowsSharedActing: true,
    servedUnits: [
      {
        guid: 'link-active',
        unitGuid: 'u-b',
        unitName: 'Unidade B',
        startDate: '2026-01-02',
        endDate: null,
        active: true,
      },
      {
        guid: 'link-ended',
        unitGuid: 'u-c',
        unitName: 'Unidade C',
        startDate: '2025-01-02',
        endDate: '2025-12-31',
        active: false,
      },
    ],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };
}

const FULL = ['SETOR_VISUALIZAR', 'SETOR_EDITAR', 'FUNCIONARIO_VISUALIZAR'];
const NO_STAFF = ['SETOR_VISUALIZAR', 'SETOR_EDITAR'];

describe('SectorDetailComponent', () => {
  let fixture: ComponentFixture<SectorDetailComponent>;
  let c: DetailInternals;
  let addSectorServedUnit: jasmine.Spy;
  let endSectorServedUnit: jasmine.Spy;
  let listHospitalUnits: jasmine.Spy;
  let notifications: NotificationService;

  function setup(permissions: string[]): void {
    addSectorServedUnit = jasmine
      .createSpy('addSectorServedUnit')
      .and.returnValue(of({ guid: 'new-link' }));
    endSectorServedUnit = jasmine.createSpy('endSectorServedUnit').and.returnValue(of(undefined));
    listHospitalUnits = jasmine
      .createSpy('listHospitalUnits')
      .and.returnValue(of({ items: UNITS, page: 1, pageSize: 100, total: UNITS.length }));

    const catalog: Partial<OrganizationCatalogService> = {
      getSector: () => of(sectorResponse()) as never,
      listHospitalUnits: listHospitalUnits as never,
      addSectorServedUnit: addSectorServedUnit as never,
      endSectorServedUnit: endSectorServedUnit as never,
      changeSectorStatus: jasmine
        .createSpy('changeSectorStatus')
        .and.returnValue(of(sectorResponse())) as never,
    };

    TestBed.configureTestingModule({
      imports: [SectorDetailComponent],
      providers: [provideRouter([]), { provide: OrganizationCatalogService, useValue: catalog }],
    });

    TestBed.inject(AuthStore).setIdentity(identity(permissions));
    notifications = TestBed.inject(NotificationService);

    fixture = TestBed.createComponent(SectorDetailComponent);
    fixture.componentRef.setInput('sectorGuid', 'sec-1');
    c = fixture.componentInstance as unknown as DetailInternals;
    fixture.detectChanges();
  }

  function query(selector: string): HTMLElement | null {
    return fixture.nativeElement.querySelector(selector);
  }

  function buttonByText(text: string): HTMLButtonElement | undefined {
    return Array.from(fixture.nativeElement.querySelectorAll('button')).find(
      (b) => (b as HTMLElement).textContent?.trim() === text,
    ) as HTMLButtonElement | undefined;
  }

  // ---- full capability: SETOR_VISUALIZAR + SETOR_EDITAR + FUNCIONARIO_VISUALIZAR ----

  describe('with the full "add served unit" capability', () => {
    beforeEach(() => setup(FULL));

    it('renders the "Adicionar unidade atendida" form', () => {
      expect(c.canAddServedUnit()).toBe(true);
      expect(query('#su-unit')).not.toBeNull();
    });

    it('loads the unit catalog for the select', () => {
      c.loadUnits();
      expect(listHospitalUnits).toHaveBeenCalledTimes(1);
      expect(c.availableUnits().map((u) => u.guid)).toEqual(['u-c']); // u-a principal, u-b active
    });

    it('links a valid unit + date', () => {
      c.loadUnits();
      c.servedUnitForm.setValue({ unitGuid: 'u-c', startDate: '2026-02-01' });
      c.addServedUnit();
      expect(addSectorServedUnit).toHaveBeenCalledOnceWith('sec-1', {
        unitGuid: 'u-c',
        startDate: '2026-02-01',
      });
    });

    it('still rejects the principal unit and units with an active link', () => {
      const warn = spyOn(notifications, 'warning');
      c.servedUnitForm.setValue({ unitGuid: 'u-a', startDate: '2026-02-01' });
      c.addServedUnit();
      c.servedUnitForm.setValue({ unitGuid: 'u-b', startDate: '2026-02-01' });
      c.addServedUnit();
      expect(addSectorServedUnit).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledTimes(2);
    });

    it('does not link without a start date', () => {
      c.servedUnitForm.setValue({ unitGuid: 'u-c', startDate: '' });
      c.addServedUnit();
      expect(addSectorServedUnit).not.toHaveBeenCalled();
    });
  });

  // ---- SETOR_EDITAR but NOT FUNCIONARIO_VISUALIZAR ----

  describe('without FUNCIONARIO_VISUALIZAR', () => {
    beforeEach(() => setup(NO_STAFF));

    it('still renders the sector detail', () => {
      expect(query('.page__title')?.textContent).toContain('Farmácia Central');
    });

    it('hides the "Adicionar unidade atendida" form', () => {
      expect(c.canAddServedUnit()).toBe(false);
      expect(query('#su-unit')).toBeNull();
    });

    it('never calls listHospitalUnits, even if loadUnits() is invoked', () => {
      c.loadUnits();
      expect(listHospitalUnits).not.toHaveBeenCalled();
    });

    it('does not POST a served unit if addServedUnit() is invoked programmatically', () => {
      c.servedUnitForm.setValue({ unitGuid: 'u-c', startDate: '2026-02-01' });
      c.addServedUnit();
      expect(addSectorServedUnit).not.toHaveBeenCalled();
    });

    it('still shows and runs "Encerrar" for an active link (only needs SETOR_EDITAR)', () => {
      const btn = buttonByText('Encerrar');
      expect(btn).withContext('Encerrar button should be visible').toBeDefined();

      spyOn(window, 'prompt').and.returnValue('2026-06-01');
      c.endServedUnit('link-active');
      expect(endSectorServedUnit).toHaveBeenCalledOnceWith('sec-1', 'link-active', {
        endDate: '2026-06-01',
      });
    });
  });
});
