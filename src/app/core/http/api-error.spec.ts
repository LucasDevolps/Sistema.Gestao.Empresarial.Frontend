import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { DUPLICATE_BUSINESS_KEY, describeFieldErrors, toApiError } from './api-error';

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

  describe('409 DUPLICATE_BUSINESS_KEY', () => {
    it('maps field "name" to a safe "already exists by name" message', () => {
      const result = toApiError(
        httpError({
          status: 409,
          error: {
            status: 409,
            title: 'Registro duplicado.',
            detail: 'Já existe um registro com este nome.',
            code: DUPLICATE_BUSINESS_KEY,
            field: 'name',
            correlationId: 'corr-1',
          },
        }),
      );
      expect(result.status).toBe(409);
      expect(result.code).toBe(DUPLICATE_BUSINESS_KEY);
      expect(result.field).toBe('name');
      expect(result.message).toBe('Já existe um registro com este nome.');
      expect(result.correlationId).toBe('corr-1');
    });

    it('maps field "sigla" to the sector/sigla message', () => {
      const result = toApiError(
        httpError({
          status: 409,
          error: { title: 'Registro duplicado.', code: DUPLICATE_BUSINESS_KEY, field: 'sigla' },
        }),
      );
      expect(result.message).toBe('Já existe um setor com esta sigla nesta unidade hospitalar.');
    });

    it('maps field "email" to the e-mail message', () => {
      const result = toApiError(
        httpError({
          status: 409,
          error: { code: DUPLICATE_BUSINESS_KEY, field: 'email' },
        }),
      );
      expect(result.message).toContain('e-mail');
    });

    it('never surfaces infrastructure detail even on a DUPLICATE_BUSINESS_KEY code', () => {
      const leak =
        "Violation of UNIQUE KEY constraint 'IX_Setores_Nome'. Cannot insert duplicate key row " +
        'in object dbo.Setores. SELECT * FROM Setores; at Sistema.Infra.Repo.Save()';
      const result = toApiError(
        httpError({
          status: 409,
          error: {
            status: 409,
            title: 'Registro duplicado.',
            detail: leak,
            code: DUPLICATE_BUSINESS_KEY,
            // no recognised `field` → detail would be the only fallback
            correlationId: 'corr-2',
          },
        }),
      );
      expect(result.message).not.toContain('IX_Setores_Nome');
      expect(result.message).not.toContain('SELECT');
      expect(result.message).not.toContain('constraint');
      expect(result.message).not.toContain('dbo.Setores');
      expect(result.message.toLowerCase()).toContain('já existe');
      expect(result.correlationId).toBe('corr-2');
    });

    it('uses a safe backend detail when there is no recognised field', () => {
      const result = toApiError(
        httpError({
          status: 409,
          error: {
            title: 'Registro duplicado.',
            detail: 'Já existe um registro com esta chave de negócio.',
            code: DUPLICATE_BUSINESS_KEY,
          },
        }),
      );
      expect(result.message).toBe('Já existe um registro com esta chave de negócio.');
    });
  });

  it('treats a 409 without DUPLICATE_BUSINESS_KEY as a generic concurrency conflict', () => {
    const result = toApiError(
      httpError({
        status: 409,
        error: { status: 409, title: 'Conflito de concorrência.', correlationId: 'corr-3' },
      }),
    );
    expect(result.code).toBeUndefined();
    expect(result.field).toBeUndefined();
    expect(result.message).toBe(
      'O registro foi alterado por outra operação. Recarregue e tente de novo.',
    );
    expect(result.correlationId).toBe('corr-3');
  });

  it('does not treat a non-409 that happens to carry the code as a duplication', () => {
    const result = toApiError(
      httpError({ status: 422, error: { title: 'Operação não permitida.', code: DUPLICATE_BUSINESS_KEY } }),
    );
    expect(result.message).toContain('regras do sistema');
  });
});
