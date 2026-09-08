import { HttpParams } from '@angular/common/http';

/**
 * Build an {@link HttpParams} from a plain object, omitting entries that are
 * `null`, `undefined` or an empty string.
 *
 * The backend validators reject empty query values (`page=`, `active=`, empty
 * Guids) and there are no sorting parameters, so we never send them
 * (spec "Regras comuns dos contratos").
 */
export function buildParams(source: Record<string, string | number | boolean | null | undefined>): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(source)) {
    if (value === null || value === undefined) {
      continue;
    }
    if (typeof value === 'string' && value.trim().length === 0) {
      continue;
    }
    params = params.set(key, String(value));
  }
  return params;
}
