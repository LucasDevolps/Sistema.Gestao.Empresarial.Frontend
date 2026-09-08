import { Injectable } from '@angular/core';
import { AuthenticationResponse } from '../models/auth.models';

/**
 * Volatile, in-memory holder for the access token, refresh token and session id.
 *
 * Spec sections 8, 9, 65: while the backend returns tokens in the JSON body (no
 * HttpOnly cookie), NOTHING here may touch localStorage, sessionStorage,
 * IndexedDB, cookies or any other persistence. A page reload therefore loses the
 * session and the user is sent back to login — by design.
 *
 * Plain private fields (not signals) keep these values out of any reactive
 * devtools surface.
 */
@Injectable({ providedIn: 'root' })
export class TokenStore {
  private accessTokenValue: string | null = null;
  private refreshTokenValue: string | null = null;
  private sessionIdValue: string | null = null;

  get accessToken(): string | null {
    return this.accessTokenValue;
  }

  get sessionId(): string | null {
    return this.sessionIdValue;
  }

  hasTokens(): boolean {
    return this.accessTokenValue !== null && this.refreshTokenValue !== null && this.sessionIdValue !== null;
  }

  /** Read the refresh payload. Only the AuthService should call this. */
  refreshPayload(): { sessionId: string; refreshToken: string } | null {
    if (this.refreshTokenValue === null || this.sessionIdValue === null) {
      return null;
    }
    return { sessionId: this.sessionIdValue, refreshToken: this.refreshTokenValue };
  }

  /** Atomically replace all three values after login or a token rotation. */
  set(response: AuthenticationResponse): void {
    this.accessTokenValue = response.accessToken;
    this.refreshTokenValue = response.refreshToken;
    this.sessionIdValue = response.sessionId;
  }

  clear(): void {
    this.accessTokenValue = null;
    this.refreshTokenValue = null;
    this.sessionIdValue = null;
  }
}
