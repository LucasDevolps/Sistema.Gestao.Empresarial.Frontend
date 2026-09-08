import { HttpErrorResponse } from '@angular/common/http';
import { ProblemDetails } from '../models/api.models';

/**
 * Normalised, UI-safe view of a failed HTTP call.
 *
 * Never surfaces stack traces, SQL, hostnames or other backend internals
 * (spec sections 22, 23). Only the safe `correlationId` is kept for support.
 */
export interface ApiError {
  /** HTTP status, or 0 for a transport/connectivity failure. */
  status: number;
  /** Short, user-facing message already localised to pt-BR. */
  message: string;
  /** Safe diagnostic id, when the backend provided one. */
  correlationId?: string;
  /** Field-level messages from a 400 ValidationProblemDetails, keyed by field name. */
  fieldErrors?: Record<string, string[]>;
  /** Seconds to wait, parsed from the `Retry-After` header on a 429. */
  retryAfterSeconds?: number;
}

const GENERIC_MESSAGE = 'Não foi possível concluir a operação. Tente novamente em instantes.';

const STATUS_MESSAGES: Record<number, string> = {
  0: 'Sem conexão com o servidor. Verifique sua rede e tente novamente.',
  400: 'Alguns dados informados são inválidos. Revise o formulário.',
  401: 'Sua sessão não está mais ativa. Entre novamente.',
  403: 'Você não tem permissão para executar esta ação.',
  404: 'O registro solicitado não foi encontrado.',
  409: 'O registro foi alterado por outra operação. Recarregue e tente de novo.',
  422: 'A operação não é permitida pelas regras do sistema.',
  429: 'Muitas solicitações em pouco tempo. Aguarde um momento antes de repetir.',
  500: 'Ocorreu um erro interno no servidor.',
  502: 'O servidor está temporariamente indisponível.',
  503: 'O serviço está temporariamente indisponível.',
  504: 'O servidor demorou para responder. Tente novamente.',
};

function isProblemDetails(body: unknown): body is ProblemDetails {
  return typeof body === 'object' && body !== null;
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.ceil(seconds);
  }
  const asDate = Date.parse(value);
  if (!Number.isNaN(asDate)) {
    return Math.max(0, Math.ceil((asDate - Date.now()) / 1000));
  }
  return undefined;
}

export function toApiError(error: unknown): ApiError {
  if (!(error instanceof HttpErrorResponse)) {
    return { status: 0, message: GENERIC_MESSAGE };
  }

  const status = error.status;
  const body: unknown = error.error;
  const problem = isProblemDetails(body) ? body : undefined;

  // Prefer a safe business message the backend chose to expose in `title`.
  const backendTitle =
    problem && typeof problem.title === 'string' && problem.title.trim().length > 0
      ? problem.title.trim()
      : undefined;

  const message =
    (status === 400 && backendTitle) || STATUS_MESSAGES[status] || backendTitle || GENERIC_MESSAGE;

  const fieldErrors =
    problem && problem.errors && typeof problem.errors === 'object'
      ? (problem.errors as Record<string, string[]>)
      : undefined;

  return {
    status,
    message,
    correlationId:
      problem && typeof problem.correlationId === 'string' ? problem.correlationId : undefined,
    fieldErrors,
    retryAfterSeconds: status === 429 ? parseRetryAfter(error.headers.get('Retry-After')) : undefined,
  };
}

/** Flatten field errors into a single readable string for a toast. */
export function describeFieldErrors(fieldErrors: Record<string, string[]> | undefined): string | null {
  if (!fieldErrors) {
    return null;
  }
  const messages = Object.values(fieldErrors).flat().filter(Boolean);
  return messages.length > 0 ? messages.join(' ') : null;
}
