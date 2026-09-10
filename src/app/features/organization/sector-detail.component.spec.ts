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
  servedUnitForm: FormGroup<{ unitGuid: FormControl<string>; startDate: FormControl<string> }>;
  addServedUnit(): void;
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

describe('SectorDetailComponent — served-unit linking rules (task 3.3)', () => {
  let fixture: ComponentFixture<SectorDetailComponent>;
  let c: DetailInternals;
  let addSectorServedUnit: jasmine.Spy;
  let notifications: NotificationService;

  beforeEach(() => {
    addSectorServedUnit = jasmine
      .createSpy('addSectorServedUnit')
      .and.returnValue(of({ guid: 'new-link' }));

    const catalog: Partial<OrganizationCatalogService> = {
      getSector: () => of(sectorResponse()) as never,
      listHospitalUnits: () =>
        of({ items: UNITS, page: 1, pageSize: 100, total: UNITS.length }) as never,
      addSectorServedUnit: addSectorServedUnit as never,
      changeSectorStatus: jasmine
        .createSpy('changeSectorStatus')
        .and.returnValue(of(sectorResponse())) as never,
    };

    TestBed.configureTestingModule({
      imports: [SectorDetailComponent],
      providers: [provideRouter([]), { provide: OrganizationCatalogService, useValue: catalog }],
    });

    TestBed.inject(AuthStore).setIdentity(identity(['SETOR_VISUALIZAR', 'SETOR_EDITAR', 'FUNCIONARIO_VISUALIZAR']));
    notifications = TestBed.inject(NotificationService);

    fixture = TestBed.createComponent(SectorDetailComponent);
    fixture.componentRef.setInput('sectorGuid', 'sec-1');
    c = fixture.componentInstance as unknown as DetailInternals;
    fixture.detectChanges();
    c.loadUnits();
  });

  it('offers neither the principal unit nor units with an active link', () => {
    const guids = c.availableUnits().map((u) => u.guid);
    expect(guids).not.toContain('u-a'); // principal
    expect(guids).not.toContain('u-b'); // active link
    expect(guids).toContain('u-c'); // link ended → selectable again
  });

  it('rejects adding the principal unit as a served unit', () => {
    const warn = spyOn(notifications, 'warning');
    c.servedUnitForm.setValue({ unitGuid: 'u-a', startDate: '2026-02-01' });

    c.addServedUnit();

    expect(addSectorServedUnit).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
  });

  it('rejects adding a unit that already has an active link', () => {
    const warn = spyOn(notifications, 'warning');
    c.servedUnitForm.setValue({ unitGuid: 'u-b', startDate: '2026-02-01' });

    c.addServedUnit();

    expect(addSectorServedUnit).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
  });

  it('allows adding a unit whose previous link was ended', () => {
    c.servedUnitForm.setValue({ unitGuid: 'u-c', startDate: '2026-02-01' });

    c.addServedUnit();

    expect(addSectorServedUnit).toHaveBeenCalledOnceWith('sec-1', {
      unitGuid: 'u-c',
      startDate: '2026-02-01',
    });
  });

  it('does not add a served unit without a start date', () => {
    c.servedUnitForm.setValue({ unitGuid: 'u-c', startDate: '' });

    c.addServedUnit();

    expect(addSectorServedUnit).not.toHaveBeenCalled();
  });
});
