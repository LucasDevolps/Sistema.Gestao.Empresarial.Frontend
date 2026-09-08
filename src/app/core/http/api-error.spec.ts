import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { describeFieldErrors, toApiError } from './api-error';

function httpError(init: {
  status: number;
  error?: unknown;
  headers?: Record<string, string>;
}): HttpErrorResponse {
  return new HttpErrorResponse({
    status: init.status,
    error: init.error,
    headers: new HttpHeaders(init.headers ?? {}),
  });
}

describe('toApiError', () => {
  it('maps a transport failure to status 0 with a safe message', () => {
    const result = toApiError(httpError({ status: 0 }));
    expect(result.status).toBe(0);
    expect(result.message).toContain('conexão');
  });

  it('uses the standard message for 401 and never leaks credentials detail', () => {
    const result = toApiError(httpError({ status: 401, error: { title: 'x' } }));
    expect(result.message).toContain('sessão');
  });

  it('exposes field errors from a 400 ValidationProblemDetails', () => {
    const result = toApiError(
      httpError({
        status: 400,
        error: { title: 'Dados inválidos', errors: { email: ['E-mail inválido.'] } },
      }),
    );
    expect(result.fieldErrors).toEqual({ email: ['E-mail inválido.'] });
    expect(describeFieldErrors(result.fieldErrors)).toBe('E-mail inválido.');
  });

  it('keeps the safe backend title for a 422 domain error', () => {
    const result = toApiError(
      httpError({ status: 422, error: { title: 'Operação não permitida.', correlationId: 'abc' } }),
    );
    expect(result.message).toContain('regras do sistema');
    expect(result.correlationId).toBe('abc');
  });

  it('parses Retry-After seconds on a 429', () => {
    const result = toApiError(httpError({ status: 429, headers: { 'Retry-After': '30' } }));
    expect(result.status).toBe(429);
    expect(result.retryAfterSeconds).toBe(30);
  });

  it('never returns undefined message', () => {
    const result = toApiError(httpError({ status: 418 }));
    expect(typeof result.message).toBe('string');
    expect(result.message.length).toBeGreaterThan(0);
  });
});
