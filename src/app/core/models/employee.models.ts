/**
 * Employee & relationship contracts.
 * Mirrors Application/Employees/EmployeeContracts.cs
 */

export interface EmployeeReference {
  guid: string;
  name: string;
}

export interface EmployeeLevel {
  guid: string;
  code: string;
  name: string;
}

export interface EmployeeActingUnitResponse {
  guid: string;
  unitGuid: string;
  unitName: string;
  /** DateOnly, `YYYY-MM-DD`. */
  startDate: string;
  endDate: string | null;
  active: boolean;
}

export interface EmployeeSectorResponse {
  guid: string;
  sectorGuid: string;
  sectorName: string;
  unitGuid: string;
  unitName: string;
  startDate: string;
  endDate: string | null;
  active: boolean;
}

/** Row shape from `GET /api/funcionarios` (EmployeePageResponse.items). */
export interface EmployeeSummaryResponse {
  guid: string;
  registrationNumber: string;
  name: string;
  email: string;
  active: boolean;
  profession: EmployeeReference;
  position: EmployeeReference;
  level: EmployeeLevel;
  hiringUnit: EmployeeReference;
}

/** Full detail from `GET /api/funcionarios/{guid}`. */
export interface EmployeeResponse {
  guid: string;
  registrationNumber: string;
  name: string;
  email: string;
  phone: string | null;
  /** DateOnly, `YYYY-MM-DD`. */
  admissionDate: string;
  active: boolean;
  profession: EmployeeReference;
  position: EmployeeReference;
  level: EmployeeLevel;
  hiringUnit: EmployeeReference;
  actingUnits: EmployeeActingUnitResponse[];
  sectors: EmployeeSectorResponse[];
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeListQuery {
  search?: string | null;
  active?: boolean | null;
  actingUnitGuid?: string | null;
  page?: number;
  pageSize?: number;
}

export interface CreateEmployeeActingUnitRequest {
  unitGuid: string;
  /** DateOnly, `YYYY-MM-DD`. */
  startDate: string;
}

export interface CreateEmployeeSectorRequest {
  sectorGuid: string;
  startDate: string;
}

/** `POST /api/funcionarios`. `phone`, `actingUnits`, `sectors` may be null; max 50 distinct items each. */
export interface CreateEmployeeRequest {
  name: string;
  email: string;
  phone: string | null;
  professionGuid: string;
  positionGuid: string;
  levelGuid: string;
  hiringUnitGuid: string;
  /** DateOnly, `YYYY-MM-DD`. */
  admissionDate: string;
  actingUnits: CreateEmployeeActingUnitRequest[] | null;
  sectors: CreateEmployeeSectorRequest[] | null;
}

/** `PUT /api/funcionarios/{guid}` — only these fields. No hiring unit / registration / admission date here. */
export interface UpdateEmployeeRequest {
  name: string;
  email: string;
  phone: string | null;
  professionGuid: string;
  positionGuid: string;
  levelGuid: string;
}

export interface ChangeEmployeeStatusRequest {
  active: boolean;
}

export interface AddEmployeeActingUnitRequest {
  unitGuid: string;
  startDate: string;
}

export interface AddEmployeeSectorRequest {
  sectorGuid: string;
  startDate: string;
}

export interface EndEmployeeRelationshipRequest {
  /** DateOnly, `YYYY-MM-DD`. */
  endDate: string;
}

export const EMPLOYEE_RELATIONSHIP_MAX_ITEMS = 50;
