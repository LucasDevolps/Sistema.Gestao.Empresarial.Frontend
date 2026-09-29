/**
 * Pure helpers for Brazilian registration data (CNPJ, CEP, phones, UF).
 *
 * The masks are *visual* only: the backend strips and re-validates everything
 * (`CadastroBrasileiro` in the API) and stores CNPJ/CEP unmasked. The checks
 * below mirror those backend rules to give immediate feedback — the API stays
 * the final authority.
 */

/** The 27 federative units accepted by the backend (`CadastroBrasileiro.UfValida`). */
export const BRAZILIAN_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;

export type MaskKind = 'cnpj' | 'cep' | 'phone';

export function onlyDigits(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '');
}

/**
 * Progressive `XX.XXX.XXX/XXXX-XX`. More than 14 digits is left as plain digits
 * so the validator can flag it instead of silently dropping what was pasted.
 */
export function formatCnpj(value: string | null | undefined): string {
  const d = onlyDigits(value);
  if (d.length > 14) {
    return d;
  }
  let out = d.slice(0, 2);
  if (d.length > 2) out += `.${d.slice(2, 5)}`;
  if (d.length > 5) out += `.${d.slice(5, 8)}`;
  if (d.length > 8) out += `/${d.slice(8, 12)}`;
  if (d.length > 12) out += `-${d.slice(12, 14)}`;
  return out;
}

/** Progressive `XXXXX-XXX`; more than 8 digits is left as plain digits. */
export function formatCep(value: string | null | undefined): string {
  const d = onlyDigits(value);
  if (d.length > 8 || d.length <= 5) {
    return d;
  }
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

/**
 * Progressive `(DD) XXXX-XXXX` / `(DD) XXXXX-XXXX`. Anything that is not a plain
 * national number (a `+55…` prefix, a `0800…` number, more than 11 digits) is
 * left exactly as typed — the backend accepts those formats too.
 */
export function formatPhone(value: string | null | undefined): string {
  const raw = value ?? '';
  const d = onlyDigits(raw);
  if (d.length === 0) {
    return raw.trim() === '' ? '' : raw;
  }
  if (/[^\d\s().-]/.test(raw) || d.startsWith('0') || d.length > 11) {
    return raw;
  }
  const ddd = d.slice(0, 2);
  if (d.length <= 2) return `(${ddd}`;
  if (d.length <= 6) return `(${ddd}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${ddd}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${ddd}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export const MASKS: Record<MaskKind, (value: string) => string> = {
  cnpj: formatCnpj,
  cep: formatCep,
  phone: formatPhone,
};

/** CNPJ with the mask characters the backend strips (`.`, `/`, `-`) removed. */
export function stripCnpjMask(value: string | null | undefined): string {
  return (value ?? '').trim().replace(/[./-]/g, '');
}

/** Same algorithm as `CadastroBrasileiro.CnpjValido`: 14 digits, not repeated, two check digits. */
export function isValidCnpj(value: string | null | undefined): boolean {
  const digits = stripCnpjMask(value);
  if (!/^\d{14}$/.test(digits) || /^(\d)\1{13}$/.test(digits)) {
    return false;
  }
  for (let size = 12; size <= 13; size++) {
    let sum = 0;
    let weight = size - 7;
    for (let i = 0; i < size; i++) {
      sum += Number(digits[i]) * weight;
      weight -= 1;
      if (weight < 2) weight = 9;
    }
    const remainder = sum % 11;
    const expected = remainder < 2 ? 0 : 11 - remainder;
    if (Number(digits[size]) !== expected) {
      return false;
    }
  }
  return true;
}

/** Same rule as `CadastroBrasileiro.CepValido`: 8 digits after removing the hyphen. */
export function isValidCep(value: string | null | undefined): boolean {
  return /^\d{8}$/.test((value ?? '').trim().replace(/-/g, ''));
}

/** Same rule as `CadastroBrasileiro.TelefoneValido`: digits and `+()-. `, 8–15 digits. */
export function isValidPhone(value: string | null | undefined): boolean {
  if (!value || value.trim() === '') {
    return true;
  }
  if (!/^[\d+().\- ]+$/.test(value)) {
    return false;
  }
  const count = onlyDigits(value).length;
  return count >= 8 && count <= 15;
}

/** Same rule as `CadastroBrasileiro.SiteValido`: absolute http(s) URL with a host. */
export function isValidHttpUrl(value: string | null | undefined): boolean {
  if (!value || value.trim() === '') {
    return true;
  }
  try {
    const url = new URL(value.trim());
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname !== '';
  } catch {
    return false;
  }
}

/** CNAE subclass `NNNNNNN` → `NNNN-N/NN`; any other shape is returned untouched. */
export function formatCnaeCode(code: string | null | undefined): string {
  const value = (code ?? '').trim();
  const d = onlyDigits(value);
  return d.length === 7 && d === value ? `${d.slice(0, 4)}-${d.slice(4, 5)}/${d.slice(5)}` : value;
}
