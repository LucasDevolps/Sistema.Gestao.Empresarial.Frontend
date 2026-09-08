import { Injectable, computed, signal } from '@angular/core';
import { CurrentUserResponse, SessionEndReason } from '../models/auth.models';

export type AuthStatus = 'anonymous' | 'authenticating' | 'authenticated';

/**
 * Reactive snapshot of the authenticated identity.
 *
 * `permissions` and `permissionVersion` are held ONLY in memory and are replaced
 * wholesale every time `/api/auth/me` is (re)loaded (spec sections 14, 49).
 * Every permission check is deny-by-default (spec section 15).
 */
@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly statusValue = signal<AuthStatus>('anonymous');
  private readonly currentUserValue = signal<CurrentUserResponse | null>(null);
  private readonly permissionsValue = signal<ReadonlySet<string>>(new Set<string>());
  private readonly sessionEndReasonValue = signal<SessionEndReason | null>(null);

  /**
   * Bumped on every successful login and on every session teardown. HTTP
   * responses captured under a previous epoch are discarded so data from a
   * signed-out user can never repaint the UI for the next one (spec sections 11, 49, 61).
   */
  private readonly epochValue = signal(0);

  readonly status = this.statusValue.asReadonly();
  readonly currentUser = this.currentUserValue.asReadonly();
  readonly permissions = this.permissionsValue.asReadonly();
  readonly sessionEndReason = this.sessionEndReasonValue.asReadonly();
  readonly epoch = this.epochValue.asReadonly();

  readonly isAuthenticated = computed(() => this.statusValue() === 'authenticated');
  readonly displayName = computed(() => {
    const user = this.currentUserValue();
    return user?.employee?.name ?? user?.email ?? '';
  });
  readonly organizationName = computed(() => this.currentUserValue()?.organization?.name ?? null);

  setAuthenticating(): void {
    this.statusValue.set('authenticating');
    this.sessionEndReasonValue.set(null);
  }

  setIdentity(user: CurrentUserResponse): void {
    this.currentUserValue.set(user);
    this.permissionsValue.set(new Set(user.permissions));
    this.statusValue.set('authenticated');
  }

  markLoggedIn(): void {
    this.epochValue.update((n) => n + 1);
  }

  reset(reason: SessionEndReason | null): void {
    this.statusValue.set('anonymous');
    this.currentUserValue.set(null);
    this.permissionsValue.set(new Set<string>());
    this.sessionEndReasonValue.set(reason);
    this.epochValue.update((n) => n + 1);
  }

  clearSessionEndReason(): void {
    this.sessionEndReasonValue.set(null);
  }

  // --- deny-by-default permission checks -----------------------------------

  hasPermission(code: string): boolean {
    return this.statusValue() === 'authenticated' && this.permissionsValue().has(code);
  }

  hasAll(codes: readonly string[]): boolean {
    return codes.length > 0 && codes.every((code) => this.hasPermission(code));
  }

  hasAny(codes: readonly string[]): boolean {
    return codes.some((code) => this.hasPermission(code));
  }
}
