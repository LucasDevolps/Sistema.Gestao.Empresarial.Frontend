import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRuntimeAppConfig } from '../../core/config/app-config';
import { ProfessionalCatalogService } from './professional-catalog.service';

describe('ProfessionalCatalogService — professional levels', () => {
  let service: ProfessionalCatalogService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRuntimeAppConfig()],
    });
    service = TestBed.inject(ProfessionalCatalogService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('lists levels with the paginated catalog contract, omitting empty filters', () => {
    let total = -1;
    service.listLevels({ search: null, active: true, page: 2, pageSize: 20 }).subscribe((page) => {
      total = page.total;
    });

    const req = httpMock.expectOne((r) => r.url === '/api/niveis-profissionais');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.has('search')).toBe(false);
    expect(req.request.params.get('active')).toBe('true');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('pageSize')).toBe('20');
    req.flush({ items: [], page: 2, pageSize: 20, total: 7 });
    expect(total).toBe(7);
  });

  it('gets a level by its public guid', () => {
    service.getLevel('lvl-1').subscribe();
    const req = httpMock.expectOne('/api/niveis-profissionais/lvl-1');
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('creates a level with POST and the upsert body', () => {
    service.createLevel({ code: 'ESP', name: 'Especialista', order: 4 }).subscribe();
    const req = httpMock.expectOne('/api/niveis-profissionais');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ code: 'ESP', name: 'Especialista', order: 4 });
    req.flush({});
  });

  it('updates a level with PUT on its guid', () => {
    service.updateLevel('lvl-1', { code: 'SR', name: 'Sênior', order: 3 }).subscribe();
    const req = httpMock.expectOne('/api/niveis-profissionais/lvl-1');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ code: 'SR', name: 'Sênior', order: 3 });
    req.flush({});
  });

  it('deletes logically through the explicit action — never HTTP DELETE', () => {
    let completed = false;
    service.deleteLevel('lvl-1').subscribe({ complete: () => (completed = true) });
    const req = httpMock.expectOne('/api/niveis-profissionais/lvl-1/excluir');
    expect(req.request.method).toBe('POST');
    req.flush(null, { status: 204, statusText: 'No Content' });
    expect(completed).toBeTrue();
  });
});
