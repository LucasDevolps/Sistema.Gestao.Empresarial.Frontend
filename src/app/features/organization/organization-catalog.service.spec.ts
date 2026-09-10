import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRuntimeAppConfig } from '../../core/config/app-config';
import { OrganizationCatalogService } from './organization-catalog.service';

describe('OrganizationCatalogService', () => {
  let service: OrganizationCatalogService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRuntimeAppConfig()],
    });
    service = TestBed.inject(OrganizationCatalogService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('omits empty sector filters and keeps explicit ones', () => {
    service
      .listSectors({
        search: '  ',
        active: false,
        unitGuid: null,
        categoryGuid: 'cat-1',
        page: 2,
        pageSize: 20,
      })
      .subscribe();
    const req = httpMock.expectOne((r) => r.url === '/api/setores');
    expect(req.request.params.has('search')).toBe(false);
    expect(req.request.params.has('unitGuid')).toBe(false);
    expect(req.request.params.get('active')).toBe('false');
    expect(req.request.params.get('categoryGuid')).toBe('cat-1');
    expect(req.request.params.get('page')).toBe('2');
    req.flush({ items: [], page: 2, pageSize: 20, total: 0 });
  });

  it('creates a sector with a POST to /api/setores', () => {
    const body = {
      unitGuid: 'u-1',
      categoryGuid: 'c-1',
      name: 'Central de Análise de Prescrições',
      sigla: 'CAP',
      description: null,
      internalLocation: null,
      extension: null,
      email: null,
      responsibleEmployeeGuid: null,
      careRelated: true,
      allowsScheduleAllocation: true,
      allowsSharedActing: false,
      servedUnits: null,
    };
    service.createSector(body).subscribe();
    const req = httpMock.expectOne('/api/setores');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({ guid: 's-1' });
  });

  it('targets the served-unit sub-resource endpoints', () => {
    service.addSectorServedUnit('s-1', { unitGuid: 'u-2', startDate: '2026-01-05' }).subscribe();
    const add = httpMock.expectOne('/api/setores/s-1/unidades-atendidas');
    expect(add.request.method).toBe('POST');
    add.flush({ guid: 'rel-1' });

    service.endSectorServedUnit('s-1', 'rel-1', { endDate: '2026-02-01' }).subscribe();
    const end = httpMock.expectOne('/api/setores/s-1/unidades-atendidas/rel-1/encerrar');
    expect(end.request.method).toBe('POST');
    expect(end.request.body).toEqual({ endDate: '2026-02-01' });
    end.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('changes sector status with PATCH', () => {
    service.changeSectorStatus('s-1', { active: false }).subscribe();
    const req = httpMock.expectOne('/api/setores/s-1/status');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ active: false });
    req.flush({ guid: 's-1', active: false });
  });

  it('maps the sector category CRUD endpoints', () => {
    service.listSectorCategories({ active: true, page: 1, pageSize: 50 }).subscribe();
    const list = httpMock.expectOne((r) => r.url === '/api/categorias-setor');
    expect(list.request.params.get('active')).toBe('true');
    list.flush({ items: [], page: 1, pageSize: 50, total: 0 });

    service.createSectorCategory({ name: 'Diagnóstico', description: null }).subscribe();
    const create = httpMock.expectOne('/api/categorias-setor');
    expect(create.request.method).toBe('POST');
    create.flush({ guid: 'c-1' });

    service.updateSectorCategory('c-1', { name: 'Diagnóstico por imagem', description: null }).subscribe();
    const update = httpMock.expectOne('/api/categorias-setor/c-1');
    expect(update.request.method).toBe('PUT');
    update.flush({ guid: 'c-1' });
  });
});
