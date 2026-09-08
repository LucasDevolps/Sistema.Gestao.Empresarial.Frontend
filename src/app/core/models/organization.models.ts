/**
 * Organization / hospital unit / sector contracts.
 * Mirrors Application/Organizations/OrganizationCatalogContracts.cs
 *
 * All three are read-only: the backend exposes NO create/edit/status endpoints
 * for organizations, hospital units or sectors (spec sections 27, 28, 33).
 */

export interface OrganizationResponse {
  guid: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationReference {
  guid: string;
  name: string;
}

export interface HospitalUnitReference {
  guid: string;
  name: string;
}

export interface HospitalUnitResponse {
  guid: string;
  name: string;
  active: boolean;
  organization: OrganizationReference;
  createdAt: string;
  updatedAt: string;
}

export interface SectorResponse {
  guid: string;
  name: string;
  active: boolean;
  unit: HospitalUnitReference;
  createdAt: string;
  updatedAt: string;
}

export interface SectorListQuery {
  search?: string | null;
  active?: boolean | null;
  unitGuid?: string | null;
  page?: number;
  pageSize?: number;
}
