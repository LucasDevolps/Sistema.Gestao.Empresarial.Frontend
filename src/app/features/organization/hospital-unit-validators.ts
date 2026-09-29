import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import {
  isValidCep,
  isValidCnpj,
  isValidHttpUrl,
  isValidPhone,
  stripCnpjMask,
} from '../../shared/format/brazilian-formats';

/**
 * Client-side mirrors of `HospitalUnitRegistrationRequestValidator` (backend PR
 * #101). They exist for immediate feedback only — no rule here is stricter than
 * the API, and the API re-validates every request.
 */

function text(control: AbstractControl): string {
  const value: unknown = control.value;
  return typeof value === 'string' ? value : '';
}

/** `NotEmpty()`: `Validators.required` would accept a blank-only string. */
export const requiredText: ValidatorFn = (control) =>
  text(control).trim().length === 0 ? { required: true } : null;

/** CNPJ, when informed: 14 digits after removing the mask, with valid check digits. */
export const cnpjValidator: ValidatorFn = (control) => {
  const value = text(control).trim();
  if (value === '') {
    return null;
  }
  if (!/^\d{14}$/.test(stripCnpjMask(value))) {
    return { cnpjFormat: true };
  }
  return isValidCnpj(value) ? null : { cnpjDigits: true };
};

/** `hasOwnCnpj = true` ⇒ CNPJ required. Re-run when the flag changes. */
export const cnpjRequiredWhenOwn: ValidatorFn = (control) => {
  const ownCnpj = control.parent?.get('hasOwnCnpj')?.value === true;
  return ownCnpj && text(control).trim() === '' ? { required: true } : null;
};

/** Any CNPJ informed ⇒ legal name required. Re-run when the CNPJ changes. */
export const legalNameRequiredWithCnpj: ValidatorFn = (control) => {
  const cnpj: unknown = control.parent?.get('cnpj')?.value;
  const hasCnpj = typeof cnpj === 'string' && cnpj.trim() !== '';
  return hasCnpj && text(control).trim() === '' ? { required: true } : null;
};

/** CEP: 8 digits after removing the hyphen (required-ness is a separate validator). */
export const cepValidator: ValidatorFn = (control) => {
  const value = text(control).trim();
  return value === '' || isValidCep(value) ? null : { cep: true };
};

/** Optional field that, when informed, must be exactly `length` ASCII digits (CNES, IBGE, DDD). */
export function exactDigits(length: number): ValidatorFn {
  return (control) => {
    const value = text(control).trim();
    return value === '' || new RegExp(`^\\d{${length}}$`).test(value)
      ? null
      : { digits: { length } };
  };
}

export const phoneValidator: ValidatorFn = (control) =>
  isValidPhone(text(control)) ? null : { phone: true };

export const httpUrlValidator: ValidatorFn = (control) =>
  isValidHttpUrl(text(control)) ? null : { url: true };

/** Beds: optional, integer, never negative. */
export const bedCount: ValidatorFn = (control) => {
  const value: unknown = control.value;
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return { integer: true };
  }
  return value < 0 ? { min: { min: 0, actual: value } } : null;
};

/** ICU beds cannot exceed total beds when both are known. Re-run when the total changes. */
export const icuBedsWithinTotal: ValidatorFn = (control): ValidationErrors | null => {
  const icu: unknown = control.value;
  const total: unknown = control.parent?.get('totalBeds')?.value;
  if (typeof icu !== 'number' || typeof total !== 'number') {
    return null;
  }
  return icu > total ? { icuExceedsTotal: true } : null;
};
