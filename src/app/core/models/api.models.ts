/**
 * Shared HTTP contract shapes.
 *
 * These model the JSON on the wire, not the backend C# classes. Every server
 * response is camelCased by ASP.NET Core's default serializer.
 */

/** RFC 7807 problem document as emitted by the API (spec section 22). */
export interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  /** Safe diagnostic identifier surfaced by the backend middleware. */
  correlationId?: string;
  /** Present on 400 validation responses (ValidationProblemDetails). */
  errors?: Record<string, string[]>;
}

/**
 * Paginated envelope. The backend uses this exact shape for employees, users,
 * hospital units, sectors, professions and positions:
 * `{ items, page, pageSize, total }` (spec sections 36, 57).
 */
export interface PagedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

/** Common server-side list parameters. Undefined fields are omitted from the query string. */
export interface PageQuery {
  search?: string | null;
  active?: boolean | null;
  page?: number;
  pageSize?: number;
}

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
