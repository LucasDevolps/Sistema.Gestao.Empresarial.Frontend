import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { APP_CONFIG } from '../../core/config/app-config';
import { buildParams } from '../../core/http/http-params';
import { PageQuery, PagedResponse } from '../../core/models/api.models';
import {
  HospitalUnitResponse,
  OrganizationResponse,
  SectorListQuery,
  SectorResponse,
} from '../../core/models/organization.models';

/**
 * Client for `/api/organizacoes/atual`, `/api/unidades-hospitalares` and
 * `/api/setores`. Every result is already tenant-scoped by the backend — the
 * frontend only represents what it is given (spec sections 27, 28).
 *
 * There are NO create/edit/status endpoints for these resources.
 */
@Injectable({ providedIn: 'root' })
export class OrganizationCatalogService {
  private readonly http = inject(HttpClient);
  private readonly root = inject(APP_CONFIG).apiBaseUrl;

  currentOrganization(): Observable<OrganizationResponse> {
    return this.http.get<OrganizationResponse>(`${this.root}/organizacoes/atual`);
  }

  listHospitalUnits(query: PageQuery): Observable<PagedResponse<HospitalUnitResponse>> {
    const params = buildParams({
      search: query.search ?? undefined,
      active: query.active ?? undefined,
      page: query.page,
      pageSize: query.pageSize,
    });
    return this.http.get<PagedResponse<HospitalUnitResponse>>(`${this.root}/unidades-hospitalares`, {
      params,
    });
  }

  getHospitalUnit(unitGuid: string): Observable<HospitalUnitResponse> {
    return this.http.get<HospitalUnitResponse>(`${this.root}/unidades-hospitalares/${unitGuid}`);
  }

  listSectors(query: SectorListQuery): Observable<PagedResponse<SectorResponse>> {
    const params = buildParams({
      search: query.search ?? undefined,
      active: query.active ?? undefined,
      unitGuid: query.unitGuid ?? undefined,
      page: query.page,
      pageSize: query.pageSize,
    });
    return this.http.get<PagedResponse<SectorResponse>>(`${this.root}/setores`, { params });
  }

  getSector(sectorGuid: string): Observable<SectorResponse> {
    return this.http.get<SectorResponse>(`${this.root}/setores/${sectorGuid}`);
  }
}
