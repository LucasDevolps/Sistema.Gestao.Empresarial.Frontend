import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { APP_CONFIG } from '../../core/config/app-config';
import { buildParams } from '../../core/http/http-params';
import { PagedResponse } from '../../core/models/api.models';
import {
  AddEmployeeActingUnitRequest,
  AddEmployeeSectorRequest,
  ChangeEmployeeStatusRequest,
  CreateEmployeeRequest,
  EmployeeActingUnitResponse,
  EmployeeListQuery,
  EmployeeResponse,
  EmployeeSectorResponse,
  EmployeeSummaryResponse,
  EndEmployeeRelationshipRequest,
  UpdateEmployeeRequest,
} from '../../core/models/employee.models';

/**
 * Typed client for the nine employee & relationship endpoints
 * (`/api/funcionarios*`). One method per real endpoint — nothing invented.
 */
@Injectable({ providedIn: 'root' })
export class EmployeesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(APP_CONFIG).apiBaseUrl}/funcionarios`;

  list(query: EmployeeListQuery): Observable<PagedResponse<EmployeeSummaryResponse>> {
    const params = buildParams({
      search: query.search ?? undefined,
      active: query.active ?? undefined,
      actingUnitGuid: query.actingUnitGuid ?? undefined,
      page: query.page,
      pageSize: query.pageSize,
    });
    return this.http.get<PagedResponse<EmployeeSummaryResponse>>(this.base, { params });
  }

  get(employeeGuid: string): Observable<EmployeeResponse> {
    return this.http.get<EmployeeResponse>(`${this.base}/${employeeGuid}`);
  }

  create(request: CreateEmployeeRequest): Observable<EmployeeResponse> {
    return this.http.post<EmployeeResponse>(this.base, request);
  }

  update(employeeGuid: string, request: UpdateEmployeeRequest): Observable<EmployeeResponse> {
    return this.http.put<EmployeeResponse>(`${this.base}/${employeeGuid}`, request);
  }

  changeStatus(
    employeeGuid: string,
    request: ChangeEmployeeStatusRequest,
  ): Observable<EmployeeResponse> {
    return this.http.patch<EmployeeResponse>(`${this.base}/${employeeGuid}/status`, request);
  }

  addActingUnit(
    employeeGuid: string,
    request: AddEmployeeActingUnitRequest,
  ): Observable<EmployeeActingUnitResponse> {
    return this.http.post<EmployeeActingUnitResponse>(
      `${this.base}/${employeeGuid}/unidades-atuacao`,
      request,
    );
  }

  endActingUnit(
    employeeGuid: string,
    relationshipGuid: string,
    request: EndEmployeeRelationshipRequest,
  ): Observable<void> {
    return this.http.post<void>(
      `${this.base}/${employeeGuid}/unidades-atuacao/${relationshipGuid}/encerrar`,
      request,
    );
  }

  addSector(
    employeeGuid: string,
    request: AddEmployeeSectorRequest,
  ): Observable<EmployeeSectorResponse> {
    return this.http.post<EmployeeSectorResponse>(`${this.base}/${employeeGuid}/setores`, request);
  }

  endSector(
    employeeGuid: string,
    relationshipGuid: string,
    request: EndEmployeeRelationshipRequest,
  ): Observable<void> {
    return this.http.post<void>(
      `${this.base}/${employeeGuid}/setores/${relationshipGuid}/encerrar`,
      request,
    );
  }
}
