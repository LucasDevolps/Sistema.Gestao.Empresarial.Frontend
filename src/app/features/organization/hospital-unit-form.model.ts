import { FormControl, FormGroup, ValidatorFn, Validators } from '@angular/forms';
import {
  CepLookupResponse,
  CnaeLookupResponse,
  CnpjLookupResponse,
  HospitalUnitDuplicateQuery,
  HospitalUnitNature,
  HospitalUnitRegistrationData,
  HospitalUnitRegistrationRequest,
  HospitalUnitResponse,
  HospitalUnitType,
} from '../../core/models/organization.models';
import {
  formatCep,
  formatCnaeCode,
  formatCnpj,
  formatPhone,
  onlyDigits,
  stripCnpjMask,
} from '../../shared/format/brazilian-formats';
import {
  bedCount,
  cepValidator,
  cnpjRequiredWhenOwn,
  cnpjValidator,
  exactDigits,
  httpUrlValidator,
  icuBedsWithinTotal,
  legalNameRequiredWithCnpj,
  phoneValidator,
  requiredText,
} from './hospital-unit-validators';

/** Field lengths of `HospitalUnitRegistrationRequestValidator` (backend PR #101). */
export const HOSPITAL_UNIT_LIMITS = {
  secondaryCnaes: 2000,
} as const;

type BooleanKey =
  | 'open24Hours'
  | 'hasEmergencyRoom'
  | 'hasInpatientCare'
  | 'hasIcu'
  | 'hasSurgicalCenter'
  | 'hasMaternity'
  | 'hasOutpatientCare';

/** Keys whose control holds text (`''` means "not informed" and is sent as `null`). */
export type HospitalUnitTextKey = Exclude<
  keyof HospitalUnitRegistrationData,
  BooleanKey | 'hasOwnCnpj' | 'unitType' | 'nature' | 'totalBeds' | 'icuBeds'
>;

export type HospitalUnitFormControls = Record<HospitalUnitTextKey, FormControl<string>> &
  Record<BooleanKey, FormControl<boolean | null>> & {
  hasOwnCnpj: FormControl<boolean>;
  unitType: FormControl<HospitalUnitType | null>;
  nature: FormControl<HospitalUnitNature | null>;
  totalBeds: FormControl<number | null>;
  icuBeds: FormControl<number | null>;
};

export type HospitalUnitForm = FormGroup<HospitalUnitFormControls>;
export type HospitalUnitFormValue = ReturnType<HospitalUnitForm['getRawValue']>;
export type HospitalUnitControlKey = keyof HospitalUnitFormControls;

const max = Validators.maxLength;

function textControl(...validators: ValidatorFn[]): FormControl<string> {
  return new FormControl('', { nonNullable: true, validators });
}

function flagControl(): FormControl<boolean | null> {
  return new FormControl<boolean | null>(null);
}

/**
 * One flat control per JSON field of `HospitalUnitRegistrationRequest`: the
 * sections are purely visual, so payload building and server-error mapping
 * stay 1:1 with the contract. Required fields: `name`, `postalCode`, `street`,
 * `number`, `district`, `city`, `state` — plus CNPJ when `hasOwnCnpj`, and legal
 * name when a CNPJ is informed. Nothing else is mandatory.
 */
export function createHospitalUnitForm(): HospitalUnitForm {
  const form: HospitalUnitForm = new FormGroup<HospitalUnitFormControls>({
    // identification
    name: textControl(requiredText, max(200)),
    unitType: new FormControl<HospitalUnitType | null>(null),
    nature: new FormControl<HospitalUnitNature | null>(null),
    internalCode: textControl(max(50)),
    acronym: textControl(max(20)),
    activityStartDate: textControl(),
    // company
    hasOwnCnpj: new FormControl(false, { nonNullable: true }),
    cnpj: textControl(cnpjRequiredWhenOwn, cnpjValidator, max(18)),
    legalName: textControl(legalNameRequiredWithCnpj, max(200)),
    registrationStatus: textControl(max(100)),
    openingDate: textControl(),
    legalNature: textControl(max(200)),
    primaryCnae: textControl(max(200)),
    secondaryCnaes: textControl(max(HOSPITAL_UNIT_LIMITS.secondaryCnaes)),
    // address
    postalCode: textControl(requiredText, cepValidator, max(9)),
    street: textControl(requiredText, max(200)),
    number: textControl(requiredText, max(30)),
    complement: textControl(max(150)),
    district: textControl(requiredText, max(100)),
    city: textControl(requiredText, max(100)),
    state: textControl(requiredText, max(2)),
    ibgeCode: textControl(exactDigits(7)),
    region: textControl(max(30)),
    areaCode: textControl(exactDigits(2)),
    addressReference: textControl(max(300)),
    // contacts
    phone: textControl(phoneValidator, max(30)),
    secondaryPhone: textControl(phoneValidator, max(30)),
    whatsapp: textControl(phoneValidator, max(30)),
    email: textControl(Validators.email, max(254)),
    administrativeEmail: textControl(Validators.email, max(254)),
    website: textControl(httpUrlValidator, max(500)),
    extension: textControl(max(30)),
    // administrative responsible
    administrativeResponsibleName: textControl(max(200)),
    administrativeResponsibleRole: textControl(max(150)),
    administrativeResponsibleEmail: textControl(Validators.email, max(254)),
    administrativeResponsiblePhone: textControl(phoneValidator, max(30)),
    // technical responsible
    technicalResponsibleName: textControl(max(200)),
    technicalResponsibleProfession: textControl(max(150)),
    technicalResponsibleCouncil: textControl(max(50)),
    technicalResponsibleCouncilNumber: textControl(max(50)),
    technicalResponsibleCouncilState: textControl(max(2)),
    technicalResponsibleEmail: textControl(Validators.email, max(254)),
    technicalResponsiblePhone: textControl(phoneValidator, max(30)),
    // clinical director
    clinicalDirectorName: textControl(max(200)),
    clinicalDirectorCrm: textControl(max(50)),
    clinicalDirectorCrmState: textControl(max(2)),
    clinicalDirectorEmail: textControl(Validators.email, max(254)),
    clinicalDirectorPhone: textControl(phoneValidator, max(30)),
    // regulatory
    cnes: textControl(exactDigits(7)),
    stateRegistration: textControl(max(50)),
    municipalRegistration: textControl(max(50)),
    sanitaryPermit: textControl(max(100)),
    sanitaryPermitExpiry: textControl(),
    operatingLicense: textControl(max(100)),
    operatingLicenseExpiry: textControl(),
    regulatoryNotes: textControl(max(2000)),
    // operational
    open24Hours: flagControl(),
    hasEmergencyRoom: flagControl(),
    hasInpatientCare: flagControl(),
    hasIcu: flagControl(),
    totalBeds: new FormControl<number | null>(null, { validators: [bedCount] }),
    icuBeds: new FormControl<number | null>(null, { validators: [bedCount, icuBedsWithinTotal] }),
    hasSurgicalCenter: flagControl(),
    hasMaternity: flagControl(),
    hasOutpatientCare: flagControl(),
    // notes
    notes: textControl(max(2000)),
  });

  // Cross-field rules live on the dependent control (so the message and
  // aria-invalid sit next to it); re-run them whenever what they read changes.
  const c = form.controls;
  c.hasOwnCnpj.valueChanges.subscribe(() => c.cnpj.updateValueAndValidity());
  c.cnpj.valueChanges.subscribe(() => c.legalName.updateValueAndValidity());
  c.totalBeds.valueChanges.subscribe(() => c.icuBeds.updateValueAndValidity());
  return form;
}

function nullableText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * Builds the **complete** POST/PUT body. The PUT replaces the registration and
 * clears any optional field that is omitted, so every field is always sent —
 * blank text as `null`. CNPJ/CEP go unmasked; `organizationGuid` stays `null`
 * (the backend resolves the organization from the session).
 */
export function toRegistrationRequest(raw: HospitalUnitFormValue): HospitalUnitRegistrationRequest {
  const cnpj = nullableText(raw.cnpj);
  const postalCode = nullableText(raw.postalCode);
  const upper = (value: string) => nullableText(value)?.toUpperCase() ?? null;
  return {
    name: raw.name.trim(),
    legalName: nullableText(raw.legalName),
    cnpj: cnpj === null ? null : stripCnpjMask(cnpj),
    hasOwnCnpj: raw.hasOwnCnpj,
    cnes: nullableText(raw.cnes),
    unitType: raw.unitType,
    nature: raw.nature,
    internalCode: nullableText(raw.internalCode),
    acronym: nullableText(raw.acronym),
    activityStartDate: nullableText(raw.activityStartDate),
    registrationStatus: nullableText(raw.registrationStatus),
    openingDate: nullableText(raw.openingDate),
    legalNature: nullableText(raw.legalNature),
    primaryCnae: nullableText(raw.primaryCnae),
    secondaryCnaes: nullableText(raw.secondaryCnaes),
    stateRegistration: nullableText(raw.stateRegistration),
    municipalRegistration: nullableText(raw.municipalRegistration),
    postalCode: postalCode === null ? null : postalCode.replace(/-/g, ''),
    street: nullableText(raw.street),
    number: nullableText(raw.number),
    complement: nullableText(raw.complement),
    district: nullableText(raw.district),
    city: nullableText(raw.city),
    state: upper(raw.state),
    ibgeCode: nullableText(raw.ibgeCode),
    region: nullableText(raw.region),
    areaCode: nullableText(raw.areaCode),
    addressReference: nullableText(raw.addressReference),
    phone: nullableText(raw.phone),
    secondaryPhone: nullableText(raw.secondaryPhone),
    whatsapp: nullableText(raw.whatsapp),
    email: nullableText(raw.email),
    administrativeEmail: nullableText(raw.administrativeEmail),
    website: nullableText(raw.website),
    extension: nullableText(raw.extension),
    administrativeResponsibleName: nullableText(raw.administrativeResponsibleName),
    administrativeResponsibleRole: nullableText(raw.administrativeResponsibleRole),
    administrativeResponsibleEmail: nullableText(raw.administrativeResponsibleEmail),
    administrativeResponsiblePhone: nullableText(raw.administrativeResponsiblePhone),
    technicalResponsibleName: nullableText(raw.technicalResponsibleName),
    technicalResponsibleProfession: nullableText(raw.technicalResponsibleProfession),
    technicalResponsibleCouncil: nullableText(raw.technicalResponsibleCouncil),
    technicalResponsibleCouncilNumber: nullableText(raw.technicalResponsibleCouncilNumber),
    technicalResponsibleCouncilState: upper(raw.technicalResponsibleCouncilState),
    technicalResponsibleEmail: nullableText(raw.technicalResponsibleEmail),
    technicalResponsiblePhone: nullableText(raw.technicalResponsiblePhone),
    clinicalDirectorName: nullableText(raw.clinicalDirectorName),
    clinicalDirectorCrm: nullableText(raw.clinicalDirectorCrm),
    clinicalDirectorCrmState: upper(raw.clinicalDirectorCrmState),
    clinicalDirectorEmail: nullableText(raw.clinicalDirectorEmail),
    clinicalDirectorPhone: nullableText(raw.clinicalDirectorPhone),
    sanitaryPermit: nullableText(raw.sanitaryPermit),
    sanitaryPermitExpiry: nullableText(raw.sanitaryPermitExpiry),
    operatingLicense: nullableText(raw.operatingLicense),
    operatingLicenseExpiry: nullableText(raw.operatingLicenseExpiry),
    regulatoryNotes: nullableText(raw.regulatoryNotes),
    open24Hours: raw.open24Hours,
    hasEmergencyRoom: raw.hasEmergencyRoom,
    hasInpatientCare: raw.hasInpatientCare,
    hasIcu: raw.hasIcu,
    totalBeds: raw.totalBeds,
    icuBeds: raw.icuBeds,
    hasSurgicalCenter: raw.hasSurgicalCenter,
    hasMaternity: raw.hasMaternity,
    hasOutpatientCare: raw.hasOutpatientCare,
    notes: nullableText(raw.notes),
    organizationGuid: null,
  };
}

/** Loads every stored value into the form (edit) — CNPJ/CEP get the visual mask. */
export function toFormValue(unit: HospitalUnitResponse): HospitalUnitFormValue {
  const t = (value: string | null | undefined) => value ?? '';
  return {
    name: unit.name,
    unitType: unit.unitType ?? null,
    nature: unit.nature ?? null,
    internalCode: t(unit.internalCode),
    acronym: t(unit.acronym),
    activityStartDate: t(unit.activityStartDate),
    hasOwnCnpj: unit.hasOwnCnpj ?? false,
    cnpj: unit.cnpj ? formatCnpj(unit.cnpj) : '',
    legalName: t(unit.legalName),
    registrationStatus: t(unit.registrationStatus),
    openingDate: t(unit.openingDate),
    legalNature: t(unit.legalNature),
    primaryCnae: t(unit.primaryCnae),
    secondaryCnaes: t(unit.secondaryCnaes),
    postalCode: unit.postalCode ? formatCep(unit.postalCode) : '',
    street: t(unit.street),
    number: t(unit.number),
    complement: t(unit.complement),
    district: t(unit.district),
    city: t(unit.city),
    state: t(unit.state),
    ibgeCode: t(unit.ibgeCode),
    region: t(unit.region),
    areaCode: t(unit.areaCode),
    addressReference: t(unit.addressReference),
    phone: t(unit.phone),
    secondaryPhone: t(unit.secondaryPhone),
    whatsapp: t(unit.whatsapp),
    email: t(unit.email),
    administrativeEmail: t(unit.administrativeEmail),
    website: t(unit.website),
    extension: t(unit.extension),
    administrativeResponsibleName: t(unit.administrativeResponsibleName),
    administrativeResponsibleRole: t(unit.administrativeResponsibleRole),
    administrativeResponsibleEmail: t(unit.administrativeResponsibleEmail),
    administrativeResponsiblePhone: t(unit.administrativeResponsiblePhone),
    technicalResponsibleName: t(unit.technicalResponsibleName),
    technicalResponsibleProfession: t(unit.technicalResponsibleProfession),
    technicalResponsibleCouncil: t(unit.technicalResponsibleCouncil),
    technicalResponsibleCouncilNumber: t(unit.technicalResponsibleCouncilNumber),
    technicalResponsibleCouncilState: t(unit.technicalResponsibleCouncilState),
    technicalResponsibleEmail: t(unit.technicalResponsibleEmail),
    technicalResponsiblePhone: t(unit.technicalResponsiblePhone),
    clinicalDirectorName: t(unit.clinicalDirectorName),
    clinicalDirectorCrm: t(unit.clinicalDirectorCrm),
    clinicalDirectorCrmState: t(unit.clinicalDirectorCrmState),
    clinicalDirectorEmail: t(unit.clinicalDirectorEmail),
    clinicalDirectorPhone: t(unit.clinicalDirectorPhone),
    cnes: t(unit.cnes),
    stateRegistration: t(unit.stateRegistration),
    municipalRegistration: t(unit.municipalRegistration),
    sanitaryPermit: t(unit.sanitaryPermit),
    sanitaryPermitExpiry: t(unit.sanitaryPermitExpiry),
    operatingLicense: t(unit.operatingLicense),
    operatingLicenseExpiry: t(unit.operatingLicenseExpiry),
    regulatoryNotes: t(unit.regulatoryNotes),
    open24Hours: unit.open24Hours ?? null,
    hasEmergencyRoom: unit.hasEmergencyRoom ?? null,
    hasInpatientCare: unit.hasInpatientCare ?? null,
    hasIcu: unit.hasIcu ?? null,
    totalBeds: unit.totalBeds ?? null,
    icuBeds: unit.icuBeds ?? null,
    hasSurgicalCenter: unit.hasSurgicalCenter ?? null,
    hasMaternity: unit.hasMaternity ?? null,
    hasOutpatientCare: unit.hasOutpatientCare ?? null,
    notes: t(unit.notes),
  };
}

/** `8610101` + description → `8610-1/01 - description`. */
export function describeCnae(cnae: CnaeLookupResponse | null | undefined): string {
  if (!cnae) {
    return '';
  }
  return [formatCnaeCode(cnae.code), (cnae.description ?? '').trim()]
    .filter((part) => part !== '')
    .join(' - ');
}

/**
 * Consolidates the structured secondary CNAEs into the `secondaryCnaes` text
 * field (one per line), keeping only whole entries that fit the backend limit.
 */
export function joinSecondaryCnaes(
  cnaes: readonly CnaeLookupResponse[] | null | undefined,
  limit: number = HOSPITAL_UNIT_LIMITS.secondaryCnaes,
): { text: string; truncated: boolean } {
  const lines: string[] = [];
  let length = 0;
  let truncated = false;
  for (const cnae of cnaes ?? []) {
    const line = describeCnae(cnae);
    if (line === '') {
      continue;
    }
    const added = (lines.length > 0 ? 1 : 0) + line.length;
    if (length + added > limit) {
      truncated = true;
      break;
    }
    lines.push(line);
    length += added;
  }
  return { text: lines.join('\n'), truncated };
}

function hasText(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

/**
 * Applies a CNPJ lookup to the form as editable suggestions: only fields the
 * provider actually returned are overwritten; everything else is kept. Nothing
 * is saved. Returns whether some secondary CNAEs did not fit the field limit.
 */
export function applyCnpjLookup(form: HospitalUnitForm, data: CnpjLookupResponse): { truncatedCnaes: boolean } {
  const c = form.controls;
  const set = (control: FormControl<string>, value: string | null | undefined) => {
    if (hasText(value)) {
      control.setValue(value.trim());
      control.markAsDirty();
    }
  };
  set(c.legalName, data.legalName);
  set(c.name, data.name);
  set(c.registrationStatus, data.registrationStatus);
  set(c.openingDate, data.openingDate);
  set(c.legalNature, data.legalNature);
  set(c.primaryCnae, describeCnae(data.primaryCnae));
  const secondary = joinSecondaryCnaes(data.secondaryCnaes);
  set(c.secondaryCnaes, secondary.text);
  set(c.phone, hasText(data.phone) ? formatPhone(data.phone) : null);
  set(c.email, data.email?.toLowerCase());
  set(c.postalCode, hasText(data.postalCode) ? formatCep(data.postalCode) : null);
  set(c.street, data.street);
  set(c.number, data.number);
  set(c.complement, data.complement);
  set(c.district, data.district);
  set(c.city, data.city);
  set(c.state, data.state?.toUpperCase());
  return { truncatedCnaes: secondary.truncated };
}

/**
 * Applies a CEP lookup to the address as editable suggestions. The number is
 * **never** touched (ViaCEP does not return it); blank provider values (e.g. a
 * city-wide CEP without street/district) keep what the user already typed.
 */
export function applyCepLookup(form: HospitalUnitForm, data: CepLookupResponse): void {
  const c = form.controls;
  const set = (control: FormControl<string>, value: string | null | undefined) => {
    if (hasText(value)) {
      control.setValue(value.trim());
      control.markAsDirty();
    }
  };
  set(c.postalCode, formatCep(data.postalCode));
  set(c.street, data.street);
  set(c.complement, data.complement);
  set(c.district, data.district);
  set(c.city, data.city);
  set(c.state, data.state?.toUpperCase());
  set(c.ibgeCode, data.ibgeCode);
  set(c.region, data.region);
  set(c.areaCode, data.areaCode);
}

/** Body of the similarity check built from the (already valid) request. */
export function toDuplicateQuery(
  request: HospitalUnitRegistrationRequest,
  excludeGuid: string | null,
): HospitalUnitDuplicateQuery {
  return {
    name: request.name,
    legalName: request.legalName,
    postalCode: request.postalCode ?? '',
    number: request.number ?? '',
    excludeGuid,
  };
}

/** Whether any field the similarity heuristic looks at differs between two requests. */
export function similarityFieldsChanged(
  before: HospitalUnitDuplicateQuery,
  after: HospitalUnitDuplicateQuery,
): boolean {
  const norm = (value: string | null) => (value ?? '').trim().toLowerCase();
  return (
    norm(before.name) !== norm(after.name) ||
    norm(before.legalName) !== norm(after.legalName) ||
    onlyDigits(before.postalCode) !== onlyDigits(after.postalCode) ||
    norm(before.number) !== norm(after.number)
  );
}

/** Aliases the API may use for a control in a `ValidationProblemDetails`. */
const FIELD_ALIASES: Readonly<Record<string, HospitalUnitControlKey>> = {
  cep: 'postalCode',
};

/**
 * Maps `ValidationProblemDetails.errors` keys to form controls. The API emits
 * FluentValidation property names (`Name`, `PostalCode`, `TechnicalResponsibleCouncilState`)
 * and model-binding paths (`$.unitType`, `request.cnpj`), so keys are matched
 * case-insensitively on their last path segment. Anything unknown is returned
 * as `unmapped` for a general message.
 */
export function mapServerFieldErrors(
  fieldErrors: Record<string, string[]> | undefined,
  controlKeys: readonly string[],
): { mapped: Partial<Record<HospitalUnitControlKey, string>>; unmapped: string[] } {
  const byLowerKey = new Map(controlKeys.map((key) => [key.toLowerCase(), key]));
  const mapped: Partial<Record<HospitalUnitControlKey, string>> = {};
  const unmapped: string[] = [];
  for (const [rawKey, messages] of Object.entries(fieldErrors ?? {})) {
    const list = (Array.isArray(messages) ? messages : []).filter(
      (message): message is string => typeof message === 'string' && message.trim() !== '',
    );
    const segment = rawKey
      .replace(/\[\d+\]/g, '')
      .split('.')
      .filter((part) => part !== '' && part !== '$')
      .pop()
      ?.toLowerCase();
    const key = segment
      ? ((byLowerKey.get(segment) as HospitalUnitControlKey | undefined) ?? FIELD_ALIASES[segment])
      : undefined;
    if (key) {
      mapped[key] = list[0] ?? 'Valor inválido.';
    } else {
      unmapped.push(...list);
    }
  }
  return { mapped, unmapped };
}
