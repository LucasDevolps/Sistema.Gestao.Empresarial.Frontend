import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRuntimeAppConfig } from '../../core/config/app-config';
import { EmployeesService } from './employees.service';

describe('EmployeesService', () => {
  let service: EmployeesService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRuntimeAppConfig()],
    });
    service = TestBed.inject(EmployeesService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('omits empty filters and only sends the parameters that have a value', () => {
    service
      .list({ search: '  ', active: null, actingUnitGuid: null, page: 2, pageSize: 20 })
      .subscribe();
    const req = httpMock.expectOne((r) => r.url === '/api/funcionarios');
    expect(req.request.params.has('search')).toBe(false);
    expect(req.request.params.has('active')).toBe(false);
    expect(req.request.params.has('actingUnitGuid')).toBe(false);
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('pageSize')).toBe('20');
    req.flush({ items: [], page: 2, pageSize: 20, total: 0 });
  });

  it('sends active=false as an explicit value', () => {
    service.list({ search: 'ana', active: false, page: 1, pageSize: 50 }).subscribe();
    const req = httpMock.expectOne((r) => r.url === '/api/funcionarios');
    expect(req.request.params.get('search')).toBe('ana');
    expect(req.request.params.get('active')).toBe('false');
    req.flush({ items: [], page: 1, pageSize: 50, total: 0 });
  });

  it('targets the correct relationship endpoints', () => {
    service.endActingUnit('emp-1', 'rel-1', { endDate: '2026-09-07' }).subscribe();
    const req = httpMock.expectOne('/api/funcionarios/emp-1/unidades-atuacao/rel-1/encerrar');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ endDate: '2026-09-07' });
    req.flush(null, { status: 204, statusText: 'No Content' });
  });
});
