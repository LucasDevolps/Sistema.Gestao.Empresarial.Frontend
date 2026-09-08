/**
 * Authentication & identity contracts.
 *
 * Mirrors:
 *  - Application/Authentication/AuthenticationContracts.cs
 *  - Application/Identity/IdentityContracts.cs
 */

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RefreshTokenRequest {
  sessionId: string;
  refreshToken: string;
}

/**
 * Body returned by `POST /api/auth/login` and `POST /api/auth/refresh`.
 * The refresh response carries rotated tokens. There is NO HttpOnly cookie:
 * every value here lives in volatile memory only (spec sections 8, 9).
 */
export interface AuthenticationResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  /** Access-token lifetime in seconds. */
  expiresIn: number;
  sessionId: string;
  userGuid: string;
}

export interface CurrentEmployee {
  guid: string;
  registrationNumber: string;
  name: string;
  active: boolean;
}

export interface IdentityOrganization {
  guid: string;
  name: string;
}

export interface IdentityHospitalUnit {
  guid: string;
  name: string;
}

/**
 * `GET /api/auth/me`. The employee/organization/hiringUnit objects are null when
 * the user has no active employee link — such users legitimately receive 403 on
 * the scoped catalogue endpoints (spec section "Autenticação e identidade").
 */
export interface CurrentUserResponse {
  userGuid: string;
  email: string;
  active: boolean;
  permissionVersion: number;
  employee: CurrentEmployee | null;
  organization: IdentityOrganization | null;
  hiringUnit: IdentityHospitalUnit | null;
  /** Effective permission codes already resolved by the backend. */
  permissions: string[];
}

/** Why the local session was torn down — drives the message shown on /login. */
export type SessionEndReason =
  | 'logout'
  | 'expired'
  | 'revoked'
  | 'refresh-failed'
  | 'identity-failed';
