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
  /**
   * Stable backend error code (`ProblemDetails.code`), when present. The
   * frontend branches on this instead of parsing `title`/`detail` —
   * e.g. `DUPLICATE_BUSINESS_KEY` on a 409.
   */
  code?: string;
  /** Public-contract field in conflict for a `DUPLICATE_BUSINESS_KEY`. */
  field?: string;
  /** Safe diagnostic id, when the backend provided one. */
  correlationId?: string;
  /** Field-level messages from a 400 ValidationProblemDetails, keyed by field name. */
  fieldErrors?: Record<string, string[]>;
  /** Seconds to wait, parsed from the `Retry-After` header on a 429. */
  retryAfterSeconds?: number;
}

/**
 * Stable code emitted by the backend on a 409 when a natural business key (a
 * name, a sigla, an e-mail…) already belongs to another record. Distinct from a
 * plain optimistic-concurrency 409, which carries no `code`.
 */
export const DUPLICATE_BUSINESS_KEY = 'DUPLICATE_BUSINESS_KEY';

const GENERIC_MESSAGE = 'Não foi possível concluir a operação. Tente novamente em instantes.';

/** Fallback when a duplication has no recognised `field` and no safe `detail`. */
const GENERIC_DUPLICATE_MESSAGE =
  'Já existe um registro com estes dados. Revise as informações e tente novamente.';

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

/** Canned, safe messages per known public-contract field of a duplication. */
const DUPLICATE_FIELD_MESSAGES: Record<string, string> = {
  name: 'Já existe um registro com este nome.',
  nome: 'Já existe um registro com este nome.',
  sigla: 'Já existe um setor com esta sigla nesta unidade hospitalar.',
  email: 'Já existe um registro utilizando este e-mail.',
  'e-mail': 'Já existe um registro utilizando este e-mail.',
};

/**
 * Tokens that betray infrastructure detail. If `detail` matches any of these it
 * is discarded — never shown to the user — even on a trusted `code`.
 */
const UNSAFE_DETAIL_PATTERNS: RegExp[] = [
  /\b(select|insert|update|delete|drop|from|where|join|exec)\b/i, // raw SQL
  /\b(IX|PK|FK|UQ|AK|CK|DF)_[a-z0-9_]+/i, // index / constraint identifiers
  /constraint|sqlexception|stack ?trace|duplicate key|cannot insert/i,
  /\bat\s+[a-z0-9_.]+\s*\(/i, // stack frame ("at Namespace.Method(")
  /(server|data source|initial catalog|user id|password)\s*=/i, // connection string
  /\bsystem\.[a-z]/i, // .NET type names
];

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

/** Returns `detail` only when it is short, single-line and free of infra tokens. */
function safeBusinessDetail(detail: unknown): string | undefined {
  if (typeof detail !== 'string') {
    return undefined;
  }
  const trimmed = detail.trim();
  if (trimmed.length === 0 || trimmed.length > 200 || /[\r\n]/.test(trimmed)) {
    return undefined;
  }
  return UNSAFE_DETAIL_PATTERNS.some((pattern) => pattern.test(trimmed)) ? undefined : trimmed;
}

/**
 * Builds the user-facing message for a `DUPLICATE_BUSINESS_KEY` 409: a canned
 * message keyed by the public `field`, else the backend `detail` when it is
 * demonstrably safe, else a generic duplication notice.
 */
function duplicateBusinessKeyMessage(field: string | undefined, detail: unknown): string {
  const byField = field ? DUPLICATE_FIELD_MESSAGES[field.trim().toLowerCase()] : undefined;
  return byField ?? safeBusinessDetail(detail) ?? GENERIC_DUPLICATE_MESSAGE;
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

  const code =
    problem && typeof problem.code === 'string' && problem.code.trim().length > 0
      ? problem.code.trim()
      : undefined;
  const field =
    problem && typeof problem.field === 'string' && problem.field.trim().length > 0
      ? problem.field.trim()
      : undefined;

  const isBusinessDuplicate = status === 409 && code === DUPLICATE_BUSINESS_KEY;

  const message = isBusinessDuplicate
    ? duplicateBusinessKeyMessage(field, problem?.detail)
    : (status === 400 && backendTitle) || STATUS_MESSAGES[status] || backendTitle || GENERIC_MESSAGE;

  const fieldErrors =
    problem && problem.errors && typeof problem.errors === 'object'
      ? (problem.errors as Record<string, string[]>)
      : undefined;

  return {
    status,
    message,
    code,
    field,
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
