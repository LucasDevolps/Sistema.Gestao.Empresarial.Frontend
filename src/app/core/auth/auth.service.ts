import { HttpClient, HttpContext, HttpContextToken } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, map, of, shareReplay, switchMap, tap, throwError } from 'rxjs';
import { APP_CONFIG } from '../config/app-config';
import {
  AuthenticationResponse,
  CurrentUserResponse,
  LoginRequest,
  RefreshTokenRequest,
  SessionEndReason,
} from '../models/auth.models';
import { AuthStore } from './auth-store';
import { TokenStore } from './token-store';

/**
 * Marks a request as originating from the auth flow itself (login/refresh/logout/me).
 * The interceptor uses it to avoid recursively triggering the refresh pipeline
 * (spec section 10).
 */
export const AUTH_FLOW_REQUEST = new HttpContextToken<boolean>(() => false);

/** Marks a request that has already been replayed once after a refresh. */
export const ALREADY_RETRIED = new HttpContextToken<boolean>(() => false);

function authFlowContext(): HttpContext {
  return new HttpContext().set(AUTH_FLOW_REQUEST, true);
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly tokens = inject(TokenStore);
  private readonly store = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly config = inject(APP_CONFIG);

  /** Single-flight guard: concurrent 401s share one refresh call (spec section 10). */
  private refreshInFlight: Observable<boolean> | null = null;
  /** Prevents a 403-triggered `/me` revalidation from looping (spec section 15). */
  private forbiddenRevalidationInFlight = false;

  private get base(): string {
    return this.config.apiBaseUrl;
  }

  // --- login -------------------------------------------------------------

  login(request: LoginRequest): Observable<CurrentUserResponse> {
    this.store.setAuthenticating();
    return this.http
      .post<AuthenticationResponse>(`${this.base}/auth/login`, request, { context: authFlowContext() })
      .pipe(
        tap((response) => this.tokens.set(response)),
        switchMap(() => this.fetchCurrentUser()),
        tap((user) => {
          this.store.setIdentity(user);
          this.store.markLoggedIn();
        }),
        catchError((error: unknown) => {
          // Either the credentials were rejected, or login succeeded but the
          // subsequent `/api/auth/me` failed. In both cases drop every token and
          // stay anonymous on the login page (spec section 44). The login
          // component surfaces the message.
          this.tokens.clear();
          this.store.reset(null);
          return throwError(() => error);
        }),
      );
  }

  // --- identity --------------------------------------------------------

  private fetchCurrentUser(): Observable<CurrentUserResponse> {
    return this.http.get<CurrentUserResponse>(`${this.base}/auth/me`, { context: authFlowContext() });
  }

  /** Reload `/api/auth/me` and replace the permission snapshot wholesale. */
  reloadIdentity(): Observable<CurrentUserResponse> {
    return this.fetchCurrentUser().pipe(tap((user) => this.store.setIdentity(user)));
  }

  // --- refresh (single-flight) ---------------------------------------

  refresh(): Observable<boolean> {
    if (this.refreshInFlight) {
      return this.refreshInFlight;
    }

    const payload = this.tokens.refreshPayload();
    if (!payload) {
      return of(false);
    }

    const body: RefreshTokenRequest = payload;
    this.refreshInFlight = this.http
      .post<AuthenticationResponse>(`${this.base}/auth/refresh`, body, { context: authFlowContext() })
      .pipe(
        tap((response) => this.tokens.set(response)),
        // Revalidate identity in a controlled way after rotation (spec section 10).
        switchMap(() => this.fetchCurrentUser()),
        map((user) => {
          this.store.setIdentity(user);
          return true;
        }),
        catchError((error: unknown) => {
          // A failed refresh OR a failed post-refresh /me both end the session,
          // with no further refresh attempt.
          this.endSession('refresh-failed');
          return of(false).pipe(tap(() => void error));
        }),
        finalize(() => {
          this.refreshInFlight = null;
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );

    return this.refreshInFlight;
  }

  // --- forbidden handling ------------------------------------------

  /**
   * Deny-by-default reaction to a 403 on a resource that used to be visible:
   * invalidate the in-memory authorization state and do at most one controlled
   * `/me` revalidation (spec section 15, "Regras comuns dos contratos").
   */
  handleForbidden(): void {
    if (this.forbiddenRevalidationInFlight || !this.store.isAuthenticated()) {
      return;
    }
    this.forbiddenRevalidationInFlight = true;
    this.reloadIdentity()
      .pipe(
        catchError(() => {
          this.endSession('identity-failed');
          return of(null);
        }),
        finalize(() => {
          this.forbiddenRevalidationInFlight = false;
        }),
      )
      .subscribe();
  }

  // --- logout ------------------------------------------------------

  logout(): void {
    const hadSession = this.tokens.hasTokens();
    if (hadSession) {
      this.http
        .post<void>(`${this.base}/auth/logout`, null, { context: authFlowContext() })
        .pipe(catchError(() => of(void 0)))
        .subscribe(() => this.endSession('logout'));
      // Tear down local state immediately; do not wait for the network (spec section 11).
      this.endSessionLocalOnly('logout');
    } else {
      this.endSession('logout');
    }
  }

  // --- session teardown -----------------------------------------

  endSession(reason: SessionEndReason): void {
    this.endSessionLocalOnly(reason);
    void this.router.navigate(['/login']);
  }

  private endSessionLocalOnly(reason: SessionEndReason): void {
    this.tokens.clear();
    this.store.reset(reason);
    this.refreshInFlight = null;
  }
}
