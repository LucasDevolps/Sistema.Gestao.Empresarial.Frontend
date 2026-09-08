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
}

/** Body for `POST`/`PUT` on professions and positions. */
export interface UpsertCatalogRequest {
  name: string;
  description: string | null;
}

export interface ChangeStatusRequest {
  active: boolean;
}
