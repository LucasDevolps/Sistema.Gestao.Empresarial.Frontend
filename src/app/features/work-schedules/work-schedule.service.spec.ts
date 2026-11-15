import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRuntimeAppConfig } from '../../core/config/app-config';
import { UpsertWorkScheduleRequest } from '../../core/models/work-schedule.models';
import { WorkScheduleService } from './work-schedule.service';

const SIX_BY_ONE: UpsertWorkScheduleRequest = {
  name: '6x1',
  consecutiveWorkDays: 6,
  restDays: 1,
  maximumConsecutiveWorkDays: 6,
  description: null,
};

describe('WorkScheduleService', () => {
  let service: WorkScheduleService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRuntimeAppConfig()],
    });
    service = TestBed.inject(WorkScheduleService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('lists with the paginated contract, sending search and active and omitting empty filters', () => {
    let total = -1;
    service
      .list({ search: '5x2', active: false, page: 2, pageSize: 20 })
      .subscribe((page) => (total = page.total));

    const req = httpMock.expectOne((r) => r.url === '/api/jornadas-trabalho');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('search')).toBe('5x2');
    expect(req.request.params.get('active')).toBe('false');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('pageSize')).toBe('20');
    req.flush({ items: [], page: 2, pageSize: 20, total: 3 });
    expect(total).toBe(3);
  });

  it('omits search and active when they are not set', () => {
    service.list({ search: null, active: null, page: 1, pageSize: 20 }).subscribe();

    const req = httpMock.expectOne((r) => r.url === '/api/jornadas-trabalho');
    expect(req.request.params.has('search')).toBeFalse();
    expect(req.request.params.has('active')).toBeFalse();
    req.flush({ items: [], page: 1, pageSize: 20, total: 0 });
  });

  it('gets a schedule by its public guid', () => {
    service.get('ws-1').subscribe();
    const req = httpMock.expectOne('/api/jornadas-trabalho/ws-1');
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('creates with POST and the upsert body', () => {
    service.create(SIX_BY_ONE).subscribe();
    const req = httpMock.expectOne('/api/jornadas-trabalho');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(SIX_BY_ONE);
    req.flush({});
  });

  it('updates with PUT on the guid', () => {
    service.update('ws-1', SIX_BY_ONE).subscribe();
    const req = httpMock.expectOne('/api/jornadas-trabalho/ws-1');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(SIX_BY_ONE);
    req.flush({});
  });

  it('changes the status with PATCH …/status — never HTTP DELETE', () => {
    service.changeStatus('ws-1', { active: false }).subscribe();
    const req = httpMock.expectOne('/api/jornadas-trabalho/ws-1/status');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ active: false });
    req.flush({});
  });
});
