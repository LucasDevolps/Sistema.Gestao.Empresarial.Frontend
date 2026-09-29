import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRuntimeAppConfig } from '../../core/config/app-config';
import { createHospitalUnitForm, toRegistrationRequest } from './hospital-unit-form.model';
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

  // --- hospital units (backend PR #101) ------------------------------

  describe('hospital units', () => {
    const body = {
      ...toRegistrationRequest(createHospitalUnitForm().getRawValue()),
      name: 'Hospital Central',
      postalCode: '01001000',
      street: 'Praça da Sé',
      number: '10',
      district: 'Sé',
      city: 'São Paulo',
      state: 'SP',
    };

    it('lists with every supported filter under its real query-parameter name', () => {
      service
        .listHospitalUnits({
          search: 'Central',
          legalName: 'Ltda',
          cnpj: '11222333000181',
          cnes: '1234567',
          city: 'São Paulo',
          state: 'SP',
          organizationGuid: 'org-1',
          active: true,
          page: 2,
          pageSize: 20,
        })
        .subscribe();
      const req = httpMock.expectOne((r) => r.url === '/api/unidades-hospitalares');
      expect(req.request.method).toBe('GET');
      const p = req.request.params;
      expect(p.keys().sort()).toEqual(
        ['active', 'city', 'cnes', 'cnpj', 'legalName', 'organizationGuid', 'page', 'pageSize', 'search', 'state'],
      );
      expect(p.get('search')).toBe('Central');
      expect(p.get('legalName')).toBe('Ltda');
      expect(p.get('cnpj')).toBe('11222333000181');
      expect(p.get('cnes')).toBe('1234567');
      expect(p.get('city')).toBe('São Paulo');
      expect(p.get('state')).toBe('SP');
      expect(p.get('organizationGuid')).toBe('org-1');
      expect(p.get('active')).toBe('true');
      expect(p.get('page')).toBe('2');
      expect(p.get('pageSize')).toBe('20');
      req.flush({ items: [], page: 2, pageSize: 20, total: 0 });
    });

    it('omits empty filters', () => {
      service.listHospitalUnits({ search: ' ', cnpj: null, active: null, page: 1, pageSize: 20 }).subscribe();
      const req = httpMock.expectOne((r) => r.url === '/api/unidades-hospitalares');
      expect(req.request.params.keys().sort()).toEqual(['page', 'pageSize']);
      req.flush({ items: [], page: 1, pageSize: 20, total: 0 });
    });

    it('gets the full registration by Guid', () => {
      service.getHospitalUnit('unit-1').subscribe();
      const req = httpMock.expectOne('/api/unidades-hospitalares/unit-1');
      expect(req.request.method).toBe('GET');
      req.flush({ guid: 'unit-1' });
    });

    it('creates with POST and the complete request body', () => {
      service.createHospitalUnit(body).subscribe();
      const req = httpMock.expectOne('/api/unidades-hospitalares');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(body);
      req.flush({ guid: 'unit-1' }, { status: 201, statusText: 'Created' });
    });

    it('replaces with PUT and the complete request body', () => {
      service.updateHospitalUnit('unit-1', body).subscribe();
      const req = httpMock.expectOne('/api/unidades-hospitalares/unit-1');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(body);
      req.flush({ guid: 'unit-1' });
    });

    it('changes status with PATCH { active }', () => {
      service.changeHospitalUnitStatus('unit-1', { active: false }).subscribe();
      const req = httpMock.expectOne('/api/unidades-hospitalares/unit-1/status');
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ active: false });
      req.flush({ guid: 'unit-1', active: false });
    });

    it('looks up a CNPJ through the backend proxy, never the provider', () => {
      service.lookupCnpj('11222333000181').subscribe();
      const req = httpMock.expectOne((r) => r.url === '/api/unidades-hospitalares/consulta-cnpj');
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('cnpj')).toBe('11222333000181');
      req.flush({});
      httpMock.expectNone((r) => r.url.includes('brasilapi'));
    });

    it('looks up a CEP through the backend proxy, never the provider', () => {
      service.lookupCep('01001000').subscribe();
      const req = httpMock.expectOne((r) => r.url === '/api/unidades-hospitalares/consulta-cep');
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('cep')).toBe('01001000');
      req.flush({});
      httpMock.expectNone((r) => r.url.includes('viacep'));
    });

    it('posts the similarity query to possiveis-duplicidades', () => {
      const query = {
        name: 'Hospital Central',
        legalName: null,
        postalCode: '01001000',
        number: '10',
        excludeGuid: 'unit-1',
      };
      let result: unknown;
      service.findHospitalUnitDuplicates(query).subscribe((r) => (result = r));
      const req = httpMock.expectOne('/api/unidades-hospitalares/possiveis-duplicidades');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(query);
      req.flush([]);
      expect(result).toEqual([]);
    });
  });
});
