import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { APP_CONFIG } from '../../core/config/app-config';
import { buildParams } from '../../core/http/http-params';
import { PageQuery, PagedResponse } from '../../core/models/api.models';
import {
  AddSectorServedUnitRequest,
  CepLookupResponse,
  ChangeHospitalUnitStatusRequest,
  ChangeSectorStatusRequest,
  CnpjLookupResponse,
  CreateSectorRequest,
  EndSectorServedUnitRequest,
  HospitalUnitDuplicateQuery,
  HospitalUnitListQuery,
  HospitalUnitRegistrationRequest,
  HospitalUnitResponse,
  HospitalUnitSummaryResponse,
  OrganizationResponse,
  SectorCategoryResponse,
  SectorListQuery,
  SectorResponse,
  SectorServedUnitResponse,
  SectorSummaryResponse,
  UpdateSectorRequest,
  UpsertSectorCategoryRequest,
} from '../../core/models/organization.models';

/**
 * Client for `/api/organizacoes/atual`, `/api/unidades-hospitalares`,
 * `/api/setores` and `/api/categorias-setor`.
 *
 * Organizations stay read-only (tenant-scoped by the backend). Hospital units,
 * sectors and sector categories are full CRUD-without-delete — one method per
 * real endpoint, nothing invented. The hospital-unit CNPJ/CEP lookups go through
 * the backend (`Angular → SGE API → BrasilAPI/ViaCEP`), never straight to the
 * providers.
 */
@Injectable({ providedIn: 'root' })
export class OrganizationCatalogService {
  private readonly http = inject(HttpClient);
  private readonly root = inject(APP_CONFIG).apiBaseUrl;

  currentOrganization(): Observable<OrganizationResponse> {
    return this.http.get<OrganizationResponse>(`${this.root}/organizacoes/atual`);
  }

  // --- hospital units ------------------------------------------------

  /** Summary projection only — never the full registration of each row. */
  listHospitalUnits(
    query: HospitalUnitListQuery,
  ): Observable<PagedResponse<HospitalUnitSummaryResponse>> {
    const params = buildParams({
      search: query.search ?? undefined,
      legalName: query.legalName ?? undefined,
      cnpj: query.cnpj ?? undefined,
      cnes: query.cnes ?? undefined,
      city: query.city ?? undefined,
      state: query.state ?? undefined,
      organizationGuid: query.organizationGuid ?? undefined,
      active: query.active ?? undefined,
      page: query.page,
      pageSize: query.pageSize,
    });
    return this.http.get<PagedResponse<HospitalUnitSummaryResponse>>(
      `${this.root}/unidades-hospitalares`,
      { params },
    );
  }

  getHospitalUnit(unitGuid: string): Observable<HospitalUnitResponse> {
    return this.http.get<HospitalUnitResponse>(`${this.root}/unidades-hospitalares/${unitGuid}`);
  }

  createHospitalUnit(request: HospitalUnitRegistrationRequest): Observable<HospitalUnitResponse> {
    return this.http.post<HospitalUnitResponse>(`${this.root}/unidades-hospitalares`, request);
  }

  /** Full replacement: every optional field omitted/null is cleared by the backend. */
  updateHospitalUnit(
    unitGuid: string,
    request: HospitalUnitRegistrationRequest,
  ): Observable<HospitalUnitResponse> {
    return this.http.put<HospitalUnitResponse>(
      `${this.root}/unidades-hospitalares/${unitGuid}`,
      request,
    );
  }

  changeHospitalUnitStatus(
    unitGuid: string,
    request: ChangeHospitalUnitStatusRequest,
  ): Observable<HospitalUnitResponse> {
    return this.http.patch<HospitalUnitResponse>(
      `${this.root}/unidades-hospitalares/${unitGuid}/status`,
      request,
    );
  }

  /** Backend proxy to BrasilAPI — the browser never calls the provider directly. */
  lookupCnpj(cnpj: string): Observable<CnpjLookupResponse> {
    return this.http.get<CnpjLookupResponse>(`${this.root}/unidades-hospitalares/consulta-cnpj`, {
      params: buildParams({ cnpj }),
    });
  }

  /** Backend proxy to ViaCEP — the browser never calls the provider directly. */
  lookupCep(cep: string): Observable<CepLookupResponse> {
    return this.http.get<CepLookupResponse>(`${this.root}/unidades-hospitalares/consulta-cep`, {
      params: buildParams({ cep }),
    });
  }

  /** Informative similarity alert; an empty array means "no candidates". Never blocks saving. */
  findHospitalUnitDuplicates(
    query: HospitalUnitDuplicateQuery,
  ): Observable<HospitalUnitSummaryResponse[]> {
    return this.http.post<HospitalUnitSummaryResponse[]>(
      `${this.root}/unidades-hospitalares/possiveis-duplicidades`,
      query,
    );
  }

  // --- sectors -------------------------------------------------------

  listSectors(query: SectorListQuery): Observable<PagedResponse<SectorSummaryResponse>> {
    const params = buildParams({
      search: query.search ?? undefined,
      active: query.active ?? undefined,
      unitGuid: query.unitGuid ?? undefined,
      categoryGuid: query.categoryGuid ?? undefined,
      page: query.page,
      pageSize: query.pageSize,
    });
    return this.http.get<PagedResponse<SectorSummaryResponse>>(`${this.root}/setores`, { params });
  }

  getSector(sectorGuid: string): Observable<SectorResponse> {
    return this.http.get<SectorResponse>(`${this.root}/setores/${sectorGuid}`);
  }

  createSector(request: CreateSectorRequest): Observable<SectorResponse> {
    return this.http.post<SectorResponse>(`${this.root}/setores`, request);
  }

  updateSector(sectorGuid: string, request: UpdateSectorRequest): Observable<SectorResponse> {
    return this.http.put<SectorResponse>(`${this.root}/setores/${sectorGuid}`, request);
  }

  changeSectorStatus(
    sectorGuid: string,
    request: ChangeSectorStatusRequest,
  ): Observable<SectorResponse> {
    return this.http.patch<SectorResponse>(`${this.root}/setores/${sectorGuid}/status`, request);
  }

  addSectorServedUnit(
    sectorGuid: string,
    request: AddSectorServedUnitRequest,
  ): Observable<SectorServedUnitResponse> {
    return this.http.post<SectorServedUnitResponse>(
      `${this.root}/setores/${sectorGuid}/unidades-atendidas`,
      request,
    );
  }

  endSectorServedUnit(
    sectorGuid: string,
    relationshipGuid: string,
    request: EndSectorServedUnitRequest,
  ): Observable<void> {
    return this.http.post<void>(
      `${this.root}/setores/${sectorGuid}/unidades-atendidas/${relationshipGuid}/encerrar`,
      request,
    );
  }

  // --- sector categories -------------------------------------------

  listSectorCategories(query: PageQuery): Observable<PagedResponse<SectorCategoryResponse>> {
    const params = buildParams({
      search: query.search ?? undefined,
      active: query.active ?? undefined,
      page: query.page,
      pageSize: query.pageSize,
    });
    return this.http.get<PagedResponse<SectorCategoryResponse>>(`${this.root}/categorias-setor`, {
      params,
    });
  }

  getSectorCategory(categoryGuid: string): Observable<SectorCategoryResponse> {
    return this.http.get<SectorCategoryResponse>(`${this.root}/categorias-setor/${categoryGuid}`);
  }

  createSectorCategory(request: UpsertSectorCategoryRequest): Observable<SectorCategoryResponse> {
    return this.http.post<SectorCategoryResponse>(`${this.root}/categorias-setor`, request);
  }

  updateSectorCategory(
    categoryGuid: string,
    request: UpsertSectorCategoryRequest,
  ): Observable<SectorCategoryResponse> {
    return this.http.put<SectorCategoryResponse>(
      `${this.root}/categorias-setor/${categoryGuid}`,
      request,
    );
  }

  changeSectorCategoryStatus(
    categoryGuid: string,
    request: ChangeSectorStatusRequest,
  ): Observable<SectorCategoryResponse> {
    return this.http.patch<SectorCategoryResponse>(
      `${this.root}/categorias-setor/${categoryGuid}/status`,
      request,
    );
  }
}
