import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { APP_CONFIG } from '../../core/config/app-config';
import { buildParams } from '../../core/http/http-params';
import { PageQuery, PagedResponse } from '../../core/models/api.models';
import {
  ChangeStatusRequest,
  PositionResponse,
  ProfessionResponse,
  ProfessionalLevelResponse,
  UpsertCatalogRequest,
} from '../../core/models/catalog.models';

/**
 * Client for `/api/profissoes`, `/api/cargos` and `/api/niveis-profissionais`.
 *
 * Professions and positions share an identical CRUD-without-delete contract, so
 * the two are handled by one generic helper. Levels are query-only.
 */
@Injectable({ providedIn: 'root' })
export class ProfessionalCatalogService {
  private readonly http = inject(HttpClient);
  private readonly root = inject(APP_CONFIG).apiBaseUrl;

  private listCatalog<T>(resource: string, query: PageQuery): Observable<PagedResponse<T>> {
    const params = buildParams({
      search: query.search ?? undefined,
      active: query.active ?? undefined,
      page: query.page,
      pageSize: query.pageSize,
    });
    return this.http.get<PagedResponse<T>>(`${this.root}/${resource}`, { params });
  }

  // --- professions -----------------------------------------------------

  listProfessions(query: PageQuery): Observable<PagedResponse<ProfessionResponse>> {
    return this.listCatalog<ProfessionResponse>('profissoes', query);
  }

  getProfession(guid: string): Observable<ProfessionResponse> {
    return this.http.get<ProfessionResponse>(`${this.root}/profissoes/${guid}`);
  }

  createProfession(request: UpsertCatalogRequest): Observable<ProfessionResponse> {
    return this.http.post<ProfessionResponse>(`${this.root}/profissoes`, request);
  }

  updateProfession(guid: string, request: UpsertCatalogRequest): Observable<ProfessionResponse> {
    return this.http.put<ProfessionResponse>(`${this.root}/profissoes/${guid}`, request);
  }

  changeProfessionStatus(guid: string, request: ChangeStatusRequest): Observable<ProfessionResponse> {
    return this.http.patch<ProfessionResponse>(`${this.root}/profissoes/${guid}/status`, request);
  }

  // --- positions -------------------------------------------------------

  listPositions(query: PageQuery): Observable<PagedResponse<PositionResponse>> {
    return this.listCatalog<PositionResponse>('cargos', query);
  }

  getPosition(guid: string): Observable<PositionResponse> {
    return this.http.get<PositionResponse>(`${this.root}/cargos/${guid}`);
  }

  createPosition(request: UpsertCatalogRequest): Observable<PositionResponse> {
    return this.http.post<PositionResponse>(`${this.root}/cargos`, request);
  }

  updatePosition(guid: string, request: UpsertCatalogRequest): Observable<PositionResponse> {
    return this.http.put<PositionResponse>(`${this.root}/cargos/${guid}`, request);
  }

  changePositionStatus(guid: string, request: ChangeStatusRequest): Observable<PositionResponse> {
    return this.http.patch<PositionResponse>(`${this.root}/cargos/${guid}/status`, request);
  }

  // --- professional levels (query-only) -----------------------------

  listLevels(active?: boolean | null): Observable<ProfessionalLevelResponse[]> {
    const params = buildParams({ active: active ?? undefined });
    return this.http.get<ProfessionalLevelResponse[]>(`${this.root}/niveis-profissionais`, { params });
  }

  getLevel(guid: string): Observable<ProfessionalLevelResponse> {
    return this.http.get<ProfessionalLevelResponse>(`${this.root}/niveis-profissionais/${guid}`);
  }
}
