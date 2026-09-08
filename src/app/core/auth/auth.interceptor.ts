import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, catchError, map, switchMap, throwError } from 'rxjs';
import { APP_CONFIG, isApiRequestUrl } from '../config/app-config';
import { NotificationService } from '../notifications/notification.service';
import { toApiError } from '../http/api-error';
import { ALREADY_RETRIED, AUTH_FLOW_REQUEST, AuthService } from './auth.service';
import { AuthStore } from './auth-store';
import { TokenStore } from './token-store';

const READABLE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Central handling of Authorization, 401 refresh, 403 deny-by-default and 429
 * (spec sections 6, 10, 15, 24).
 *
 * Rules enforced here:
 *  - Bearer is attached only to same-API requests that carry a token, and never
 *    to login/refresh.
 *  - A single 401 triggers at most one shared refresh; only a GET is replayed,
 *    exactly once. POST/PUT/PATCH/DELETE are never auto-retried.
 *  - login/refresh/logout/me never recurse into the refresh pipeline.
 *  - Responses captured under a stale auth epoch are dropped so a previous
 *    user's data cannot repaint the next user's screen.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const config = inject(APP_CONFIG);
  const tokens = inject(TokenStore);
  const auth = inject(AuthService);
  const store = inject(AuthStore);
  const notifications = inject(NotificationService);

  const isApiRequest = isApiRequestUrl(req.url, config.apiBaseUrl, document.baseURI);
  if (!isApiRequest) {
    return next(req);
  }

  const isAuthFlow = req.context.get(AUTH_FLOW_REQUEST);
  const isLoginOrRefresh = /\/auth\/(login|refresh)$/.test(req.url);

  const authorized =
    tokens.accessToken && !isLoginOrRefresh ? withBearer(req, tokens.accessToken) : req;

  const capturedEpoch = store.epoch();

  return next(authorized).pipe(
    map((event: HttpEvent<unknown>) => {
      // Drop late responses that belong to a session that has since ended or
      // been replaced (logout / user switch) — spec sections 11, 49, 61.
      if (!isAuthFlow && store.epoch() !== capturedEpoch) {
        throw new HttpErrorResponse({ status: 0, statusText: 'Stale session response discarded' });
      }
      return event;
    }),
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse)) {
        return throwError(() => error);
      }

      if (error.status === 401 && !isAuthFlow) {
        return handleUnauthorized(req, next, authorized, auth, tokens, store, capturedEpoch);
      }

      if (error.status === 403 && !isAuthFlow) {
        auth.handleForbidden();
        return throwError(() => error);
      }

      if (error.status === 429) {
        const parsed = toApiError(error);
        const suffix = parsed.retryAfterSeconds
          ? ` Tente novamente em ${parsed.retryAfterSeconds}s.`
          : '';
        notifications.warning(`Muitas solicitações em pouco tempo.${suffix}`);
        return throwError(() => error);
      }

      if (error.status === 0 || error.status === 502 || error.status === 503 || error.status === 504) {
        if (!isAuthFlow) {
          notifications.error(toApiError(error).message);
        }
      }

      return throwError(() => error);
    }),
  );
};

function withBearer(req: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

function handleUnauthorized(
  originalReq: HttpRequest<unknown>,
  next: HttpHandlerFn,
  attemptedReq: HttpRequest<unknown>,
  auth: AuthService,
  tokens: TokenStore,
  store: AuthStore,
  capturedEpoch: number,
): Observable<HttpEvent<unknown>> {
  if (attemptedReq.context.get(ALREADY_RETRIED)) {
    // Second 401 for the same request after a refresh -> give up, end session.
    auth.endSession('expired');
    return throwError(() => new HttpErrorResponse({ status: 401, statusText: 'Session expired' }));
  }

  return auth.refresh().pipe(
    switchMap((ok) => {
      if (!ok) {
        // refresh() already tore the session down.
        return throwError(
          () => new HttpErrorResponse({ status: 401, statusText: 'Refresh failed' }),
        );
      }

      if (store.epoch() !== capturedEpoch) {
        return throwError(
          () => new HttpErrorResponse({ status: 0, statusText: 'Stale session response discarded' }),
        );
      }

      // Only idempotent reads are replayed, and only once (spec section 10).
      if (!READABLE_METHODS.has(originalReq.method)) {
        return throwError(
          () => new HttpErrorResponse({ status: 401, statusText: 'Session renewed; resubmit required' }),
        );
      }

      const replay = originalReq.clone({
        setHeaders: { Authorization: `Bearer ${tokens.accessToken ?? ''}` },
        context: originalReq.context.set(ALREADY_RETRIED, true),
      });
      return next(replay);
    }),
  );
}
