import {
  HOSPITAL_UNIT_NATURES,
  HOSPITAL_UNIT_NATURE_LABELS,
  HOSPITAL_UNIT_TYPES,
  HOSPITAL_UNIT_TYPE_LABELS,
  HospitalUnitRegistrationData,
} from '../../core/models/organization.models';
import { MaskKind, formatCep, formatCnpj } from '../../shared/format/brazilian-formats';

/**
 * Visual layout of the hospital-unit registration, shared by the form and the
 * detail screen so both present the same 10 sections in the same order. The
 * `key` of every field is the JSON name of the backend contract.
 */

/** Confirmation shown before `PATCH …/status` with `active: false` (list and detail). */
export const INACTIVATE_UNIT_MESSAGE =
  'Deseja realmente inativar esta unidade hospitalar? A unidade permanecerá no histórico e seus relacionamentos não serão excluídos.';

export type HospitalUnitFieldKind =
  | 'text'
  | 'textarea'
  | 'email'
  | 'tel'
  | 'url'
  | 'date'
  | 'number'
  | 'uf'
  | 'unitType'
  | 'nature'
  | 'triState'
  | 'checkbox'
  | 'cnpj'
  | 'cep';

export type HospitalUnitFieldKey = keyof HospitalUnitRegistrationData;

export interface HospitalUnitFieldDef {
  readonly key: HospitalUnitFieldKey;
  readonly label: string;
  readonly kind: HospitalUnitFieldKind;
  readonly maxLength?: number;
  readonly hint?: string;
  /** Spans the whole row (textareas, long free text). */
  readonly wide?: boolean;
  readonly mask?: MaskKind;
  readonly inputMode?: 'numeric' | 'tel' | 'email' | 'url' | 'text';
  readonly autocomplete?: string;
  /** Stored/shown in upper case (codes, UF). */
  readonly uppercase?: boolean;
}

export interface HospitalUnitSectionDef {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly fields: readonly HospitalUnitFieldDef[];
}

export interface SelectOption<T> {
  readonly value: T;
  readonly label: string;
}

export const UNIT_TYPE_OPTIONS: readonly SelectOption<string>[] = HOSPITAL_UNIT_TYPES.map((value) => ({
  value,
  label: HOSPITAL_UNIT_TYPE_LABELS[value],
}));

export const NATURE_OPTIONS: readonly SelectOption<string>[] = HOSPITAL_UNIT_NATURES.map((value) => ({
  value,
  label: HOSPITAL_UNIT_NATURE_LABELS[value],
}));

const email = (key: HospitalUnitFieldKey, label: string): HospitalUnitFieldDef => ({
  key,
  label,
  kind: 'email',
  maxLength: 254,
  inputMode: 'email',
});

const phone = (key: HospitalUnitFieldKey, label: string): HospitalUnitFieldDef => ({
  key,
  label,
  kind: 'tel',
  maxLength: 30,
  mask: 'phone',
  inputMode: 'tel',
  hint: 'DDD + número. Também aceita +55 ou 0800.',
});

const flag = (key: HospitalUnitFieldKey, label: string): HospitalUnitFieldDef => ({
  key,
  label,
  kind: 'triState',
});

export const HOSPITAL_UNIT_SECTIONS: readonly HospitalUnitSectionDef[] = [
  {
    id: 'identification',
    title: 'Dados da unidade',
    fields: [
      { key: 'name', label: 'Nome fantasia', kind: 'text', maxLength: 200, wide: true },
      { key: 'unitType', label: 'Tipo de unidade', kind: 'unitType' },
      { key: 'nature', label: 'Natureza', kind: 'nature' },
      {
        key: 'internalCode',
        label: 'Código interno',
        kind: 'text',
        maxLength: 50,
        uppercase: true,
        hint: 'Único na organização; salvo em maiúsculas.',
      },
      { key: 'acronym', label: 'Sigla', kind: 'text', maxLength: 20, uppercase: true },
      { key: 'activityStartDate', label: 'Início das atividades', kind: 'date' },
    ],
  },
  {
    id: 'company',
    title: 'Dados empresariais / CNPJ',
    description:
      'A consulta de CNPJ apenas sugere dados: revise e ajuste antes de salvar. Nada é gravado automaticamente.',
    fields: [
      { key: 'hasOwnCnpj', label: 'Possui CNPJ próprio', kind: 'checkbox', wide: true },
      {
        key: 'cnpj',
        label: 'CNPJ',
        kind: 'cnpj',
        mask: 'cnpj',
        inputMode: 'numeric',
        hint: 'Aceita colar com ou sem pontuação.',
      },
      { key: 'legalName', label: 'Razão social', kind: 'text', maxLength: 200 },
      { key: 'registrationStatus', label: 'Situação cadastral', kind: 'text', maxLength: 100 },
      { key: 'openingDate', label: 'Data de abertura', kind: 'date' },
      { key: 'legalNature', label: 'Natureza jurídica', kind: 'text', maxLength: 200 },
      { key: 'primaryCnae', label: 'CNAE principal', kind: 'text', maxLength: 200 },
      {
        key: 'secondaryCnaes',
        label: 'CNAEs secundários',
        kind: 'textarea',
        maxLength: 2000,
        wide: true,
        hint: 'Um por linha (até 2000 caracteres).',
      },
    ],
  },
  {
    id: 'address',
    title: 'Endereço',
    description: 'A busca por CEP preenche o endereço; o número é sempre informado manualmente.',
    fields: [
      {
        key: 'postalCode',
        label: 'CEP',
        kind: 'cep',
        mask: 'cep',
        inputMode: 'numeric',
        autocomplete: 'postal-code',
      },
      { key: 'street', label: 'Logradouro', kind: 'text', maxLength: 200, autocomplete: 'address-line1' },
      { key: 'number', label: 'Número', kind: 'text', maxLength: 30 },
      { key: 'complement', label: 'Complemento', kind: 'text', maxLength: 150 },
      { key: 'district', label: 'Bairro', kind: 'text', maxLength: 100 },
      { key: 'city', label: 'Município', kind: 'text', maxLength: 100, autocomplete: 'address-level2' },
      { key: 'state', label: 'UF', kind: 'uf' },
      {
        key: 'ibgeCode',
        label: 'Código IBGE',
        kind: 'text',
        maxLength: 7,
        inputMode: 'numeric',
        hint: '7 dígitos.',
      },
      { key: 'region', label: 'Região', kind: 'text', maxLength: 30 },
      { key: 'areaCode', label: 'DDD', kind: 'text', maxLength: 2, inputMode: 'numeric' },
      {
        key: 'addressReference',
        label: 'Ponto de referência',
        kind: 'text',
        maxLength: 300,
        wide: true,
      },
    ],
  },
  {
    id: 'contacts',
    title: 'Contatos',
    fields: [
      phone('phone', 'Telefone principal'),
      phone('secondaryPhone', 'Telefone secundário'),
      phone('whatsapp', 'WhatsApp'),
      { key: 'extension', label: 'Ramal', kind: 'text', maxLength: 30 },
      email('email', 'E-mail institucional'),
      email('administrativeEmail', 'E-mail administrativo'),
      {
        key: 'website',
        label: 'Site',
        kind: 'url',
        maxLength: 500,
        inputMode: 'url',
        hint: 'Iniciando com http:// ou https://.',
        wide: true,
      },
    ],
  },
  {
    id: 'administrativeResponsible',
    title: 'Responsável administrativo',
    fields: [
      { key: 'administrativeResponsibleName', label: 'Nome', kind: 'text', maxLength: 200 },
      { key: 'administrativeResponsibleRole', label: 'Cargo', kind: 'text', maxLength: 150 },
      email('administrativeResponsibleEmail', 'E-mail'),
      phone('administrativeResponsiblePhone', 'Telefone'),
    ],
  },
  {
    id: 'technicalResponsible',
    title: 'Responsável técnico',
    fields: [
      { key: 'technicalResponsibleName', label: 'Nome', kind: 'text', maxLength: 200 },
      { key: 'technicalResponsibleProfession', label: 'Profissão', kind: 'text', maxLength: 150 },
      {
        key: 'technicalResponsibleCouncil',
        label: 'Conselho',
        kind: 'text',
        maxLength: 50,
        hint: 'Ex.: CRM, COREN, CRF.',
      },
      { key: 'technicalResponsibleCouncilNumber', label: 'Registro', kind: 'text', maxLength: 50 },
      { key: 'technicalResponsibleCouncilState', label: 'UF do registro', kind: 'uf' },
      email('technicalResponsibleEmail', 'E-mail'),
      phone('technicalResponsiblePhone', 'Telefone'),
    ],
  },
  {
    id: 'clinicalDirector',
    title: 'Diretor clínico',
    fields: [
      { key: 'clinicalDirectorName', label: 'Nome', kind: 'text', maxLength: 200 },
      { key: 'clinicalDirectorCrm', label: 'CRM', kind: 'text', maxLength: 50 },
      { key: 'clinicalDirectorCrmState', label: 'UF do CRM', kind: 'uf' },
      email('clinicalDirectorEmail', 'E-mail'),
      phone('clinicalDirectorPhone', 'Telefone'),
    ],
  },
  {
    id: 'regulatory',
    title: 'Dados regulatórios',
    fields: [
      {
        key: 'cnes',
        label: 'CNES',
        kind: 'text',
        maxLength: 7,
        inputMode: 'numeric',
        hint: '7 dígitos; único no sistema.',
      },
      { key: 'stateRegistration', label: 'Inscrição estadual', kind: 'text', maxLength: 50 },
      { key: 'municipalRegistration', label: 'Inscrição municipal', kind: 'text', maxLength: 50 },
      { key: 'sanitaryPermit', label: 'Alvará sanitário', kind: 'text', maxLength: 100 },
      { key: 'sanitaryPermitExpiry', label: 'Validade do alvará sanitário', kind: 'date' },
      { key: 'operatingLicense', label: 'Licença de funcionamento', kind: 'text', maxLength: 100 },
      { key: 'operatingLicenseExpiry', label: 'Validade da licença de funcionamento', kind: 'date' },
      {
        key: 'regulatoryNotes',
        label: 'Observações regulatórias',
        kind: 'textarea',
        maxLength: 2000,
        wide: true,
      },
    ],
  },
  {
    id: 'operational',
    title: 'Características operacionais',
    description: '"Não informado" é diferente de "Não": deixe em branco o que não souber.',
    fields: [
      flag('open24Hours', 'Atendimento 24h'),
      flag('hasEmergencyRoom', 'Pronto-socorro'),
      flag('hasInpatientCare', 'Internação'),
      flag('hasIcu', 'UTI'),
      { key: 'totalBeds', label: 'Total de leitos', kind: 'number', inputMode: 'numeric' },
      {
        key: 'icuBeds',
        label: 'Leitos de UTI',
        kind: 'number',
        inputMode: 'numeric',
        hint: 'Não pode superar o total de leitos.',
      },
      flag('hasSurgicalCenter', 'Centro cirúrgico'),
      flag('hasMaternity', 'Maternidade'),
      flag('hasOutpatientCare', 'Atendimento ambulatorial'),
    ],
  },
  {
    id: 'notes',
    title: 'Observações',
    fields: [
      { key: 'notes', label: 'Observações gerais', kind: 'textarea', maxLength: 2000, wide: true },
    ],
  },
];

function formatIsoDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

/**
 * Read-only rendering of one stored value for the detail screen, or `null` when
 * the field is empty (so the screen can skip it instead of printing dashes).
 */
export function displayValue(
  field: HospitalUnitFieldDef,
  data: HospitalUnitRegistrationData,
): string | null {
  const value = data[field.key];
  if (value === null || value === undefined || value === '') {
    return null;
  }
  switch (field.kind) {
    case 'checkbox':
    case 'triState':
      return value === true ? 'Sim' : 'Não';
    case 'unitType':
      return HOSPITAL_UNIT_TYPE_LABELS[value as keyof typeof HOSPITAL_UNIT_TYPE_LABELS] ?? String(value);
    case 'nature':
      return HOSPITAL_UNIT_NATURE_LABELS[value as keyof typeof HOSPITAL_UNIT_NATURE_LABELS] ?? String(value);
    case 'date':
      return formatIsoDate(String(value));
    case 'cnpj':
      return formatCnpj(String(value));
    case 'cep':
      return formatCep(String(value));
    default:
      return String(value);
  }
}
