/**
 * Administrative user & permission contracts.
 * Mirrors Application/Identity/IdentityContracts.cs and
 * Application/Authorization/PermissionContracts.cs
 */
import { CurrentEmployee, IdentityHospitalUnit } from './auth.models';

/** Row shape from `GET /api/usuarios` (UserPageResponse.items). */
export interface UserSummaryResponse {
  userGuid: string;
  email: string;
  active: boolean;
  temporarilyBlocked: boolean;
  /** DateTimeOffset ISO string, or null. */
  lastLoginAt: string | null;
  permissionVersion: number;
  /** Not null in this listing (users without an employee link are excluded). */
  employee: CurrentEmployee;
  hiringUnit: IdentityHospitalUnit;
}

/**
 * `GET /api/usuarios/{userGuid}/permissions`.
 * Note the field is `version` here, whereas /api/auth/me and the listing use
 * `permissionVersion` (spec section 32).
 */
export interface UserPermissionsResponse {
  userGuid: string;
  version: number;
  /** Effective permissions, origin/inheritance not distinguished. */
  permissions: string[];
}

/** Body for `PUT /api/usuarios/{userGuid}/permissions/{permissionCode}`. */
export interface SetUserPermissionRequest {
  granted: boolean;
}
