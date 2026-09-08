import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { APP_CONFIG } from '../../core/config/app-config';
import { buildParams } from '../../core/http/http-params';
import { PageQuery, PagedResponse } from '../../core/models/api.models';
import {
  SetUserPermissionRequest,
  UserPermissionsResponse,
  UserSummaryResponse,
} from '../../core/models/user.models';

/**
 * Client for the administrative user & permission endpoints
 * (`/api/usuarios*`, permission `USUARIO_GERENCIAR_PERMISSOES`).
 */
@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(APP_CONFIG).apiBaseUrl}/usuarios`;

  list(query: PageQuery): Observable<PagedResponse<UserSummaryResponse>> {
    const params = buildParams({
      search: query.search ?? undefined,
      active: query.active ?? undefined,
      page: query.page,
      pageSize: query.pageSize,
    });
    return this.http.get<PagedResponse<UserSummaryResponse>>(this.base, { params });
  }

  getPermissions(userGuid: string): Observable<UserPermissionsResponse> {
    return this.http.get<UserPermissionsResponse>(`${this.base}/${userGuid}/permissions`);
  }

  /**
   * Writes a direct grant (`granted: true`) or an explicit deny (`granted: false`).
   * Returns 204 for both a real change and a no-op. Callers MUST re-read the
   * target's permissions afterwards and must not apply optimistic UI
   * (spec section 32).
   */
  setPermission(
    userGuid: string,
    permissionCode: string,
    request: SetUserPermissionRequest,
  ): Observable<void> {
    return this.http.put<void>(
      `${this.base}/${userGuid}/permissions/${encodeURIComponent(permissionCode)}`,
      request,
    );
  }
}
