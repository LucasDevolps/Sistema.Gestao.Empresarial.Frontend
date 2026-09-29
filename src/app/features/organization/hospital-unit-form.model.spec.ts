import {
  CepLookupResponse,
  CnpjLookupResponse,
  HospitalUnitRegistrationRequest,
  HospitalUnitResponse,
} from '../../core/models/organization.models';
import {
  HospitalUnitForm,
  applyCepLookup,
  applyCnpjLookup,
  createHospitalUnitForm,
  joinSecondaryCnaes,
  mapServerFieldErrors,
  similarityFieldsChanged,
  toDuplicateQuery,
  toFormValue,
  toRegistrationRequest,
} from './hospital-unit-form.model';

/** Every JSON property of `HospitalUnitRegistrationRequest` (backend PR #101). */
const REQUEST_KEYS = [
  'name', 'legalName', 'cnpj', 'hasOwnCnpj', 'cnes', 'unitType', 'nature', 'internalCode',
  'acronym', 'activityStartDate', 'registrationStatus', 'openingDate', 'legalNature',
  'primaryCnae', 'secondaryCnaes', 'stateRegistration', 'municipalRegistration', 'postalCode',
  'street', 'number', 'complement', 'district', 'city', 'state', 'ibgeCode', 'region', 'areaCode',
  'addressReference', 'phone', 'secondaryPhone', 'whatsapp', 'email', 'administrativeEmail',
  'website', 'extension', 'administrativeResponsibleName', 'administrativeResponsibleRole',
  'administrativeResponsibleEmail', 'administrativeResponsiblePhone', 'technicalResponsibleName',
  'technicalResponsibleProfession', 'technicalResponsibleCouncil',
  'technicalResponsibleCouncilNumber', 'technicalResponsibleCouncilState',
  'technicalResponsibleEmail', 'technicalResponsiblePhone', 'clinicalDirectorName',
  'clinicalDirectorCrm', 'clinicalDirectorCrmState', 'clinicalDirectorEmail',
  'clinicalDirectorPhone', 'sanitaryPermit', 'sanitaryPermitExpiry', 'operatingLicense',
  'operatingLicenseExpiry', 'regulatoryNotes', 'open24Hours', 'hasEmergencyRoom',
  'hasInpatientCare', 'hasIcu', 'totalBeds', 'icuBeds', 'hasSurgicalCenter', 'hasMaternity',
  'hasOutpatientCare', 'notes', 'organizationGuid',
];

function fillRequired(form: HospitalUnitForm): void {
  form.patchValue({
    name: 'Hospital Central',
    postalCode: '01001-000',
    street: 'Praça da Sé',
    number: '10',
    district: 'Sé',
    city: 'São Paulo',
    state: 'SP',
  });
}

export function fullUnit(overrides: Partial<HospitalUnitResponse> = {}): HospitalUnitResponse {
  return {
    guid: 'unit-1',
    name: 'Hospital Central',
    active: true,
    organization: { guid: 'org-1', name: 'Rede Saúde' },
    createdAt: '2026-01-01T10:00:00Z',
    updatedAt: '2026-02-01T10:00:00Z',
    legalName: 'Hospital Central Ltda',
    cnpj: '11222333000181',
    hasOwnCnpj: true,
    cnes: '1234567',
    unitType: 'HospitalGeral',
    nature: 'Privada',
    internalCode: 'HC',
    acronym: 'HCE',
    activityStartDate: '2001-05-10',
    registrationStatus: 'ATIVA',
    openingDate: '2000-01-15',
    legalNature: 'Sociedade Empresária Limitada',
    primaryCnae: '8610-1/01 - Atividades de atendimento hospitalar',
    secondaryCnaes: '8630-5/03 - Atividade médica ambulatorial',
    stateRegistration: 'ISENTO',
    municipalRegistration: '123456',
    postalCode: '01001000',
    street: 'Praça da Sé',
    number: '10',
    complement: 'Bloco A',
    district: 'Sé',
    city: 'São Paulo',
    state: 'SP',
    ibgeCode: '3550308',
    region: 'Sudeste',
    areaCode: '11',
    addressReference: 'Em frente à catedral',
    phone: '(11) 3333-4444',
    secondaryPhone: null,
    whatsapp: '(11) 98765-4321',
    email: 'contato@hospital.test',
    administrativeEmail: 'adm@hospital.test',
    website: 'https://hospital.test',
    extension: '200',
    administrativeResponsibleName: 'Ana Admin',
    administrativeResponsibleRole: 'Diretora administrativa',
    administrativeResponsibleEmail: 'ana@hospital.test',
    administrativeResponsiblePhone: '(11) 3333-5555',
    technicalResponsibleName: 'Bruno Técnico',
    technicalResponsibleProfession: 'Médico',
    technicalResponsibleCouncil: 'CRM',
    technicalResponsibleCouncilNumber: '123456',
    technicalResponsibleCouncilState: 'SP',
    technicalResponsibleEmail: 'bruno@hospital.test',
    technicalResponsiblePhone: '(11) 3333-6666',
    clinicalDirectorName: 'Carla Diretora',
    clinicalDirectorCrm: '654321',
    clinicalDirectorCrmState: 'SP',
    clinicalDirectorEmail: 'carla@hospital.test',
    clinicalDirectorPhone: '(11) 3333-7777',
    sanitaryPermit: 'AS-001',
    sanitaryPermitExpiry: '2027-12-31',
    operatingLicense: 'LF-002',
    operatingLicenseExpiry: '2027-06-30',
    regulatoryNotes: 'Sem pendências.',
    open24Hours: true,
    hasEmergencyRoom: true,
    hasInpatientCare: true,
    hasIcu: true,
    totalBeds: 120,
    icuBeds: 20,
    hasSurgicalCenter: true,
    hasMaternity: false,
    hasOutpatientCare: null,
    notes: 'Unidade de referência.',
    ...overrides,
  };
}

function cnpjLookup(overrides: Partial<CnpjLookupResponse> = {}): CnpjLookupResponse {
  return {
    cnpj: '11222333000181',
    legalName: 'Hospital Consultado Ltda',
    name: 'Hospital Consultado',
    registrationStatus: 'ATIVA',
    openingDate: '1999-03-01',
    legalNature: 'Sociedade Empresária Limitada',
    primaryCnae: { code: '8610101', description: 'Atividades de atendimento hospitalar' },
    secondaryCnaes: [
      { code: '8630503', description: 'Atividade médica ambulatorial restrita a consultas' },
      { code: '8640202', description: 'Laboratórios clínicos' },
    ],
    phone: '1133334444',
    email: 'CONTATO@CONSULTADO.TEST',
    postalCode: '01310100',
    street: 'Avenida Paulista',
    number: '1000',
    complement: null,
    district: 'Bela Vista',
    city: 'São Paulo',
    state: 'sp',
    inactiveRegistrationWarning: false,
    ...overrides,
  };
}

describe('hospital-unit form model', () => {
  let form: HospitalUnitForm;

  beforeEach(() => {
    form = createHospitalUnitForm();
  });

  describe('validation (mirrors HospitalUnitRegistrationRequestValidator)', () => {
    it('an empty form is invalid only because of the backend-required fields', () => {
      const invalid = Object.entries(form.controls)
        .filter(([, control]) => control.invalid)
        .map(([key]) => key)
        .sort();
      expect(invalid).toEqual(['city', 'district', 'name', 'number', 'postalCode', 'state', 'street']);
    });

    it('treats blank-only text as missing', () => {
      fillRequired(form);
      form.controls.name.setValue('   ');
      expect(form.controls.name.hasError('required')).toBeTrue();
    });

    it('is valid with only the required fields', () => {
      fillRequired(form);
      expect(form.valid).toBeTrue();
    });

    it('requires the CNPJ when the unit has its own CNPJ', () => {
      fillRequired(form);
      form.controls.hasOwnCnpj.setValue(true);
      expect(form.controls.cnpj.hasError('required')).toBeTrue();
      form.controls.hasOwnCnpj.setValue(false);
      expect(form.controls.cnpj.valid).toBeTrue();
    });

    it('requires the legal name whenever a CNPJ is informed', () => {
      fillRequired(form);
      form.controls.cnpj.setValue('11.222.333/0001-81');
      expect(form.controls.legalName.hasError('required')).toBeTrue();
      form.controls.legalName.setValue('Hospital Central Ltda');
      expect(form.valid).toBeTrue();
    });

    it('rejects a CNPJ with the wrong length or wrong check digits', () => {
      form.controls.cnpj.setValue('11.222.333/0001');
      expect(form.controls.cnpj.hasError('cnpjFormat')).toBeTrue();
      form.controls.cnpj.setValue('11.222.333/0001-82');
      expect(form.controls.cnpj.hasError('cnpjDigits')).toBeTrue();
    });

    it('validates e-mail, URL, phone, CEP and fixed-length digit fields', () => {
      form.patchValue({
        email: 'not-an-email',
        website: 'hospital.test',
        phone: '123',
        postalCode: '0100',
        cnes: '123',
        ibgeCode: '35503',
        areaCode: '1',
      });
      expect(form.controls.email.hasError('email')).toBeTrue();
      expect(form.controls.website.hasError('url')).toBeTrue();
      expect(form.controls.phone.hasError('phone')).toBeTrue();
      expect(form.controls.postalCode.hasError('cep')).toBeTrue();
      expect(form.controls.cnes.hasError('digits')).toBeTrue();
      expect(form.controls.ibgeCode.hasError('digits')).toBeTrue();
      expect(form.controls.areaCode.hasError('digits')).toBeTrue();
    });

    it('rejects negative total beds and negative ICU beds', () => {
      form.controls.totalBeds.setValue(-1);
      form.controls.icuBeds.setValue(-2);
      expect(form.controls.totalBeds.hasError('min')).toBeTrue();
      expect(form.controls.icuBeds.hasError('min')).toBeTrue();
    });

    it('rejects fractional beds', () => {
      form.controls.totalBeds.setValue(1.5);
      expect(form.controls.totalBeds.hasError('integer')).toBeTrue();
    });

    it('rejects more ICU beds than total beds, and re-checks when the total changes', () => {
      form.controls.totalBeds.setValue(10);
      form.controls.icuBeds.setValue(11);
      expect(form.controls.icuBeds.hasError('icuExceedsTotal')).toBeTrue();
      form.controls.totalBeds.setValue(20);
      expect(form.controls.icuBeds.valid).toBeTrue();
      form.controls.totalBeds.setValue(null);
      form.controls.icuBeds.setValue(50);
      expect(form.controls.icuBeds.valid).toBeTrue(); // unknown total: no comparison
    });

    it('enforces the backend maximum lengths', () => {
      form.controls.name.setValue('x'.repeat(201));
      form.controls.secondaryCnaes.setValue('x'.repeat(2001));
      expect(form.controls.name.hasError('maxlength')).toBeTrue();
      expect(form.controls.secondaryCnaes.hasError('maxlength')).toBeTrue();
    });
  });

  describe('payload', () => {
    it('always sends every contract field, with blanks as null (the PUT is a replacement)', () => {
      fillRequired(form);
      const request = toRegistrationRequest(form.getRawValue());
      expect(Object.keys(request).sort()).toEqual([...REQUEST_KEYS].sort());
      expect(request.complement).toBeNull();
      expect(request.unitType).toBeNull();
      expect(request.open24Hours).toBeNull();
      expect(request.totalBeds).toBeNull();
      expect(request.hasOwnCnpj).toBeFalse();
      expect(request.organizationGuid).toBeNull();
    });

    it('sends CNPJ and CEP unmasked, enum names (not labels) and trimmed text', () => {
      fillRequired(form);
      form.patchValue({
        name: '  Hospital Central  ',
        cnpj: '11.222.333/0001-81',
        legalName: 'Hospital Central Ltda',
        unitType: 'UnidadeProntoAtendimento',
        nature: 'Filantropica',
        technicalResponsibleCouncilState: 'rj',
      });
      const request = toRegistrationRequest(form.getRawValue());
      expect(request.name).toBe('Hospital Central');
      expect(request.cnpj).toBe('11222333000181');
      expect(request.postalCode).toBe('01001000');
      expect(request.unitType).toBe('UnidadeProntoAtendimento');
      expect(request.nature).toBe('Filantropica');
      expect(request.technicalResponsibleCouncilState).toBe('RJ');
    });

    it('round-trips a complete unit loaded for edition without losing any field', () => {
      const unit = fullUnit();
      form.reset(toFormValue(unit));
      expect(form.valid).toBeTrue();
      expect(form.controls.cnpj.value).toBe('11.222.333/0001-81');
      expect(form.controls.postalCode.value).toBe('01001-000');

      const request = toRegistrationRequest(form.getRawValue());
      const expected: HospitalUnitRegistrationRequest = {
        ...(Object.fromEntries(
          REQUEST_KEYS.filter((key) => key !== 'organizationGuid').map((key) => [
            key,
            unit[key as keyof HospitalUnitResponse],
          ]),
        ) as unknown as HospitalUnitRegistrationRequest),
        organizationGuid: null,
      };
      expect(request).toEqual(expected);
    });

    it('loads a legacy unit with a null address without crashing', () => {
      const legacy = fullUnit({ postalCode: null, street: null, number: null, cnpj: null });
      form.reset(toFormValue(legacy));
      expect(form.controls.postalCode.value).toBe('');
      expect(form.controls.street.hasError('required')).toBeTrue();
    });
  });

  describe('CNPJ lookup autofill', () => {
    it('fills the returned fields as editable suggestions', () => {
      applyCnpjLookup(form, cnpjLookup());
      const v = form.getRawValue();
      expect(v.legalName).toBe('Hospital Consultado Ltda');
      expect(v.name).toBe('Hospital Consultado');
      expect(v.registrationStatus).toBe('ATIVA');
      expect(v.openingDate).toBe('1999-03-01');
      expect(v.primaryCnae).toBe('8610-1/01 - Atividades de atendimento hospitalar');
      expect(v.secondaryCnaes).toBe(
        '8630-5/03 - Atividade médica ambulatorial restrita a consultas\n8640-2/02 - Laboratórios clínicos',
      );
      expect(v.phone).toBe('(11) 3333-4444');
      expect(v.email).toBe('contato@consultado.test');
      expect(v.postalCode).toBe('01310-100');
      expect(v.street).toBe('Avenida Paulista');
      expect(v.number).toBe('1000');
      expect(v.state).toBe('SP');

      form.controls.name.setValue('Nome ajustado');
      expect(form.controls.name.value).toBe('Nome ajustado');
    });

    it('keeps what the user typed when the provider returns nothing for a field', () => {
      form.patchValue({ name: 'Nome digitado', complement: 'Sala 2' });
      applyCnpjLookup(form, cnpjLookup({ name: null, complement: '  ' }));
      expect(form.controls.name.value).toBe('Nome digitado');
      expect(form.controls.complement.value).toBe('Sala 2');
    });

    it('keeps only whole secondary CNAEs that fit the 2000-character limit', () => {
      const many = Array.from({ length: 60 }, (_, i) => ({
        code: String(1000000 + i),
        description: 'Descrição longa de atividade econômica secundária',
      }));
      const joined = joinSecondaryCnaes(many);
      expect(joined.truncated).toBeTrue();
      expect(joined.text.length).toBeLessThanOrEqual(2000);
      expect(joined.text.split('\n').every((line) => line.endsWith('secundária'))).toBeTrue();
    });
  });

  describe('CEP lookup autofill', () => {
    const cep: CepLookupResponse = {
      postalCode: '01001000',
      street: 'Praça da Sé',
      complement: 'lado ímpar',
      district: 'Sé',
      city: 'São Paulo',
      state: 'SP',
      ibgeCode: '3550308',
      areaCode: '11',
      region: 'Sudeste',
    };

    it('fills the address and never replaces the number', () => {
      form.patchValue({ number: '742' });
      applyCepLookup(form, cep);
      const v = form.getRawValue();
      expect(v.number).toBe('742');
      expect(v.street).toBe('Praça da Sé');
      expect(v.complement).toBe('lado ímpar');
      expect(v.district).toBe('Sé');
      expect(v.city).toBe('São Paulo');
      expect(v.state).toBe('SP');
      expect(v.ibgeCode).toBe('3550308');
      expect(v.region).toBe('Sudeste');
      expect(v.areaCode).toBe('11');
      expect(v.postalCode).toBe('01001-000');
    });

    it('keeps typed street/district for a city-wide CEP and stays editable', () => {
      form.patchValue({ street: 'Rua digitada', district: 'Centro' });
      applyCepLookup(form, { ...cep, street: null, district: '', complement: null });
      expect(form.controls.street.value).toBe('Rua digitada');
      expect(form.controls.district.value).toBe('Centro');
      form.controls.city.setValue('Outra cidade');
      expect(form.controls.city.value).toBe('Outra cidade');
    });
  });

  describe('similarity check helpers', () => {
    it('builds the duplicate query with excludeGuid for edits', () => {
      fillRequired(form);
      const request = toRegistrationRequest(form.getRawValue());
      expect(toDuplicateQuery(request, 'unit-1')).toEqual({
        name: 'Hospital Central',
        legalName: null,
        postalCode: '01001000',
        number: '10',
        excludeGuid: 'unit-1',
      });
    });

    it('detects only changes the similarity heuristic looks at', () => {
      const base = { name: 'Hospital', legalName: null, postalCode: '01001000', number: '10', excludeGuid: 'g' };
      expect(similarityFieldsChanged(base, { ...base, name: ' hospital ' })).toBeFalse();
      expect(similarityFieldsChanged(base, { ...base, postalCode: '01001-000' })).toBeFalse();
      expect(similarityFieldsChanged(base, { ...base, number: '11' })).toBeTrue();
      expect(similarityFieldsChanged(base, { ...base, legalName: 'Outra Ltda' })).toBeTrue();
    });
  });

  describe('server field errors', () => {
    const keys = Object.keys(createHospitalUnitForm().controls);

    it('maps FluentValidation (PascalCase) and model-binding keys to controls', () => {
      const { mapped, unmapped } = mapServerFieldErrors(
        {
          Name: ["'Name' must not be empty."],
          PostalCode: ['CEP deve possuir 8 dígitos.'],
          TechnicalResponsibleCouncilState: ['UF inválida.'],
          '$.unitType': ['The JSON value could not be converted.'],
          cep: ['CEP inválido.'],
          request: ['The request field is required.'],
        },
        keys,
      );
      expect(mapped.name).toBe("'Name' must not be empty.");
      expect(mapped.postalCode).toBe('CEP inválido.');
      expect(mapped.technicalResponsibleCouncilState).toBe('UF inválida.');
      expect(mapped.unitType).toBe('The JSON value could not be converted.');
      expect(unmapped).toEqual(['The request field is required.']);
    });

    it('tolerates an absent or malformed errors object', () => {
      expect(mapServerFieldErrors(undefined, keys)).toEqual({ mapped: {}, unmapped: [] });
    });
  });
});
