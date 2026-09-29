/**
 * Organization / hospital unit / sector contracts.
 * Mirrors Application/Organizations/OrganizationCatalogContracts.cs,
 * HospitalUnitRegistrationContracts.cs and HospitalLookupContracts.cs.
 *
 * Organizations are read-only (tenant-scoped by the backend). Hospital units,
 * sectors and sector categories are full CRUD-without-delete: create / update /
 * status change plus, for sectors, temporal "served unit" links
 * (`SetorUnidadeAtendida`). Hospital units also expose backend-proxied CNPJ
 * (BrasilAPI) and CEP (ViaCEP) lookups and a non-blocking similarity check
 * (backend PR #101).
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

// --- hospital units ----------------------------------------------------

/** `TipoUnidadeHospitalar`, serialized by name (`JsonStringEnumConverter`). */
export const HOSPITAL_UNIT_TYPES = [
  'HospitalGeral',
  'HospitalEspecializado',
  'HospitalDia',
  'UnidadeProntoAtendimento',
  'Clinica',
  'Maternidade',
  'Ambulatorio',
  'CentroDiagnostico',
  'Outro',
] as const;
export type HospitalUnitType = (typeof HOSPITAL_UNIT_TYPES)[number];

/** `NaturezaUnidadeHospitalar`, serialized by name (`JsonStringEnumConverter`). */
export const HOSPITAL_UNIT_NATURES = [
  'Publica',
  'Privada',
  'Filantropica',
  'Conveniada',
  'Outra',
] as const;
export type HospitalUnitNature = (typeof HOSPITAL_UNIT_NATURES)[number];

/** UI labels only — the API always receives the enum names above. */
export const HOSPITAL_UNIT_TYPE_LABELS: Record<HospitalUnitType, string> = {
  HospitalGeral: 'Hospital geral',
  HospitalEspecializado: 'Hospital especializado',
  HospitalDia: 'Hospital-dia',
  UnidadeProntoAtendimento: 'Unidade de pronto atendimento',
  Clinica: 'Clínica',
  Maternidade: 'Maternidade',
  Ambulatorio: 'Ambulatório',
  CentroDiagnostico: 'Centro diagnóstico',
  Outro: 'Outro',
};

export const HOSPITAL_UNIT_NATURE_LABELS: Record<HospitalUnitNature, string> = {
  Publica: 'Pública',
  Privada: 'Privada',
  Filantropica: 'Filantrópica',
  Conveniada: 'Conveniada',
  Outra: 'Outra',
};

/**
 * Row shape for `GET /api/unidades-hospitalares` and for
 * `POST /api/unidades-hospitalares/possiveis-duplicidades`
 * (`HospitalUnitSummaryResponse`). `cnpj` comes unmasked (14 digits).
 */
export interface HospitalUnitSummaryResponse {
  guid: string;
  name: string;
  active: boolean;
  organization: OrganizationReference;
  createdAt: string;
  updatedAt: string;
  legalName: string | null;
  cnpj: string | null;
  cnes: string | null;
  city: string | null;
  state: string | null;
}

/**
 * Every registration field, shared verbatim by the full response and by the
 * POST/PUT body (`HospitalUnitRegistrationRequest`). `name` is the trade name
 * (nome fantasia). Dates are `DateOnly` (`yyyy-MM-dd`); the operational flags
 * are nullable so "unknown" differs from "no". CNPJ/CEP are stored unmasked.
 */
export interface HospitalUnitRegistrationData {
  name: string;
  legalName: string | null;
  cnpj: string | null;
  hasOwnCnpj: boolean;
  cnes: string | null;
  unitType: HospitalUnitType | null;
  nature: HospitalUnitNature | null;
  internalCode: string | null;
  acronym: string | null;
  activityStartDate: string | null;
  registrationStatus: string | null;
  openingDate: string | null;
  legalNature: string | null;
  primaryCnae: string | null;
  secondaryCnaes: string | null;
  stateRegistration: string | null;
  municipalRegistration: string | null;
  postalCode: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  ibgeCode: string | null;
  region: string | null;
  areaCode: string | null;
  addressReference: string | null;
  phone: string | null;
  secondaryPhone: string | null;
  whatsapp: string | null;
  email: string | null;
  administrativeEmail: string | null;
  website: string | null;
  extension: string | null;
  administrativeResponsibleName: string | null;
  administrativeResponsibleRole: string | null;
  administrativeResponsibleEmail: string | null;
  administrativeResponsiblePhone: string | null;
  technicalResponsibleName: string | null;
  technicalResponsibleProfession: string | null;
  technicalResponsibleCouncil: string | null;
  technicalResponsibleCouncilNumber: string | null;
  technicalResponsibleCouncilState: string | null;
  technicalResponsibleEmail: string | null;
  technicalResponsiblePhone: string | null;
  clinicalDirectorName: string | null;
  clinicalDirectorCrm: string | null;
  clinicalDirectorCrmState: string | null;
  clinicalDirectorEmail: string | null;
  clinicalDirectorPhone: string | null;
  sanitaryPermit: string | null;
  sanitaryPermitExpiry: string | null;
  operatingLicense: string | null;
  operatingLicenseExpiry: string | null;
  regulatoryNotes: string | null;
  open24Hours: boolean | null;
  hasEmergencyRoom: boolean | null;
  hasInpatientCare: boolean | null;
  hasIcu: boolean | null;
  totalBeds: number | null;
  icuBeds: number | null;
  hasSurgicalCenter: boolean | null;
  hasMaternity: boolean | null;
  hasOutpatientCare: boolean | null;
  notes: string | null;
}

/**
 * Full shape for `GET /api/unidades-hospitalares/{guid}` and every write
 * response (`HospitalUnitResponse`). Legacy units may carry a null address.
 */
export interface HospitalUnitResponse extends HospitalUnitRegistrationData {
  guid: string;
  active: boolean;
  organization: OrganizationReference;
  createdAt: string;
  updatedAt: string;
}

/**
 * Body for `POST /api/unidades-hospitalares` and `PUT /api/unidades-hospitalares/{guid}`.
 * The PUT *replaces* the registration: an omitted optional field is cleared, so
 * the client always sends every field. `organizationGuid` is only an optional
 * confirmation of the caller's own organization (never a tenant selector); the
 * frontend sends `null` and lets the backend resolve it from the session.
 */
export interface HospitalUnitRegistrationRequest extends HospitalUnitRegistrationData {
  organizationGuid: string | null;
}

/** Body for `PATCH /api/unidades-hospitalares/{guid}/status`. */
export interface ChangeHospitalUnitStatusRequest {
  active: boolean;
}

/** Body for `POST /api/unidades-hospitalares/possiveis-duplicidades`. */
export interface HospitalUnitDuplicateQuery {
  name: string;
  legalName: string | null;
  postalCode: string;
  number: string;
  excludeGuid: string | null;
}

/** Query of `GET /api/unidades-hospitalares` (`OrganizationCatalogListQuery`). */
export interface HospitalUnitListQuery {
  /** Trade name (nome fantasia), "contains". */
  search?: string | null;
  legalName?: string | null;
  /** Exact match after the backend strips the mask. */
  cnpj?: string | null;
  /** Exact match (7 digits). */
  cnes?: string | null;
  city?: string | null;
  /** UF, exact match. */
  state?: string | null;
  /** Narrows only inside the caller's own organization — never widens the scope. */
  organizationGuid?: string | null;
  active?: boolean | null;
  page?: number;
  pageSize?: number;
}

/** CNAE as returned by the BrasilAPI proxy (`CnaeLookupResponse`). */
export interface CnaeLookupResponse {
  code: string | null;
  description: string | null;
}

/**
 * `GET /api/unidades-hospitalares/consulta-cnpj?cnpj=` — suggestions only,
 * never persisted by the backend. `inactiveRegistrationWarning` flags a
 * registration status other than active; it is an alert, not a block.
 */
export interface CnpjLookupResponse {
  cnpj: string;
  legalName: string;
  name: string | null;
  registrationStatus: string | null;
  openingDate: string | null;
  legalNature: string | null;
  primaryCnae: CnaeLookupResponse;
  secondaryCnaes: CnaeLookupResponse[];
  phone: string | null;
  email: string | null;
  postalCode: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  inactiveRegistrationWarning: boolean;
}

/**
 * `GET /api/unidades-hospitalares/consulta-cep?cep=` — ViaCEP suggestions. It
 * never returns the street number, which stays a manual field.
 */
export interface CepLookupResponse {
  postalCode: string;
  street: string | null;
  complement: string | null;
  district: string | null;
  city: string;
  state: string;
  ibgeCode: string | null;
  areaCode: string | null;
  region: string | null;
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
