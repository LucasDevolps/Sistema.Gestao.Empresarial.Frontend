/**
 * Organization / hospital unit / sector contracts.
 * Mirrors Application/Organizations/OrganizationCatalogContracts.cs
 *
 * Organizations and hospital units are read-only. Sectors and sector categories
 * are full CRUD-without-delete: create / update / status change plus, for
 * sectors, temporal "served unit" links (`SetorUnidadeAtendida`).
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

export interface SectorCategoryReference {
  guid: string;
  name: string;
}

export interface SectorResponsible {
  guid: string;
  name: string;
  registrationNumber: string;
}

/** Row shape for `GET /api/setores` (list projection). */
export interface SectorSummaryResponse {
  guid: string;
  sigla: string;
  name: string;
  active: boolean;
  careRelated: boolean;
  allowsScheduleAllocation: boolean;
  allowsSharedActing: boolean;
  unit: HospitalUnitReference;
  category: SectorCategoryReference;
}

export interface SectorServedUnitResponse {
  guid: string;
  unitGuid: string;
  unitName: string;
  startDate: string;
  endDate: string | null;
  active: boolean;
}

/** Full shape for `GET /api/setores/{guid}` and every write response. */
export interface SectorResponse {
  guid: string;
  sigla: string;
  name: string;
  active: boolean;
  unit: HospitalUnitReference;
  category: SectorCategoryReference;
  description: string | null;
  internalLocation: string | null;
  extension: string | null;
  email: string | null;
  responsible: SectorResponsible | null;
  careRelated: boolean;
  allowsScheduleAllocation: boolean;
  allowsSharedActing: boolean;
  servedUnits: SectorServedUnitResponse[];
  createdAt: string;
  updatedAt: string;
}

export interface SectorCategoryResponse {
  guid: string;
  name: string;
  description: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SectorListQuery {
  search?: string | null;
  active?: boolean | null;
  unitGuid?: string | null;
  categoryGuid?: string | null;
  page?: number;
  pageSize?: number;
}

export interface CreateSectorServedUnitRequest {
  unitGuid: string;
  startDate: string;
}

/** Body for `POST /api/setores`. */
export interface CreateSectorRequest {
  unitGuid: string;
  categoryGuid: string;
  name: string;
  sigla: string;
  description: string | null;
  internalLocation: string | null;
  extension: string | null;
  email: string | null;
  responsibleEmployeeGuid: string | null;
  careRelated: boolean;
  allowsScheduleAllocation: boolean;
  allowsSharedActing: boolean;
  servedUnits: CreateSectorServedUnitRequest[] | null;
}

/** Body for `PUT /api/setores/{guid}` — the principal unit is immutable. */
export interface UpdateSectorRequest {
  categoryGuid: string;
  name: string;
  sigla: string;
  description: string | null;
  internalLocation: string | null;
  extension: string | null;
  email: string | null;
  responsibleEmployeeGuid: string | null;
  careRelated: boolean;
  allowsScheduleAllocation: boolean;
  allowsSharedActing: boolean;
}

export interface ChangeSectorStatusRequest {
  active: boolean;
}

export interface AddSectorServedUnitRequest {
  unitGuid: string;
  startDate: string;
}

export interface EndSectorServedUnitRequest {
  endDate: string;
}

/** Body for `POST` / `PUT` on sector categories. */
export interface UpsertSectorCategoryRequest {
  name: string;
  description: string | null;
}
