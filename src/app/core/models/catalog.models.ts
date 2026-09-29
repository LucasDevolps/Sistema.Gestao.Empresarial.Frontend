/**
 * Professional catalogue contracts.
 * Mirrors Application/ProfessionalCatalogs/ProfessionalCatalogContracts.cs
 */

export interface ProfessionResponse {
  guid: string;
  name: string;
  description: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PositionResponse {
  guid: string;
  name: string;
  description: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProfessionalLevelResponse {
  guid: string;
  code: string;
  name: string;
  order: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Body for `POST`/`PUT` on professions and positions. */
export interface UpsertCatalogRequest {
  name: string;
  description: string | null;
}

/**
 * Body for `POST`/`PUT` on professional levels. The backend trims both texts,
 * upper-cases `code` and enforces the limits below (Domain `NivelProfissional`).
 */
export interface UpsertProfessionalLevelRequest {
  code: string;
  name: string;
  order: number;
}

/** Limits mirrored from the backend domain (`NivelProfissional`) for UX-only validation. */
export const PROFESSIONAL_LEVEL_LIMITS = {
  codeMaxLength: 10,
  nameMaxLength: 80,
  orderMin: 1,
  orderMax: 9999,
} as const;

export interface ChangeStatusRequest {
  active: boolean;
}
