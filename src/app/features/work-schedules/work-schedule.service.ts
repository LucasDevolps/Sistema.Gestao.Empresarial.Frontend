import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { APP_CONFIG } from '../../core/config/app-config';
import { buildParams } from '../../core/http/http-params';
import { PageQuery, PagedResponse } from '../../core/models/api.models';
import { ChangeStatusRequest } from '../../core/models/catalog.models';
import {
  UpsertWorkScheduleRequest,
  WorkScheduleResponse,
} from '../../core/models/work-schedule.models';

@Injectable({ providedIn: 'root' })
export class WorkScheduleService {
  private readonly http = inject(HttpClient);
  private readonly root = `${inject(APP_CONFIG).apiBaseUrl}/jornadas-trabalho`;

  list(query: PageQuery): Observable<PagedResponse<WorkScheduleResponse>> {
    const params = buildParams({
      search: query.search ?? undefined,
      active: query.active ?? undefined,
      page: query.page,
      pageSize: query.pageSize,
    });
    return this.http.get<PagedResponse<WorkScheduleResponse>>(this.root, { params });
  }

  get(guid: string): Observable<WorkScheduleResponse> {
    return this.http.get<WorkScheduleResponse>(`${this.root}/${guid}`);
  }

  create(request: UpsertWorkScheduleRequest): Observable<WorkScheduleResponse> {
    return this.http.post<WorkScheduleResponse>(this.root, request);
  }

  update(guid: string, request: UpsertWorkScheduleRequest): Observable<WorkScheduleResponse> {
    return this.http.put<WorkScheduleResponse>(`${this.root}/${guid}`, request);
  }

  changeStatus(guid: string, request: ChangeStatusRequest): Observable<WorkScheduleResponse> {
    return this.http.patch<WorkScheduleResponse>(`${this.root}/${guid}/status`, request);
  }
}
