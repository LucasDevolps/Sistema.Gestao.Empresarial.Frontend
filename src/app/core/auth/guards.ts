import { inject } from '@angular/core';
import { CanActivateFn, CanMatchFn, Router, UrlTree } from '@angular/router';
import { NotificationService } from '../notifications/notification.service';
import { PermissionCode } from '../models/permission.model';
import { AuthStore } from './auth-store';

/**
 * Route protection is UX only. The backend remains the definitive barrier
 * (spec sections 6, 16, 51). Guards are deliberately thin.
 */

/** Blocks protected areas unless a live, authenticated session exists in memory. */
export const authGuard: CanActivateFn = (): boolean | UrlTree => {
  const store = inject(AuthStore);
  const router = inject(Router);
  if (store.isAuthenticated()) {
    return true;
  }
  return router.createUrlTree(['/login']);
};

/** Keeps authenticated users out of `/login`. */
export const guestGuard: CanActivateFn = (): boolean | UrlTree => {
  const store = inject(AuthStore);
  const router = inject(Router);
  return store.isAuthenticated() ? router.createUrlTree(['/']) : true;
};

/**
 * Deny-by-default authorization gate. The listed codes are ALL required; if any
 * is missing the navigation is refused.
 *
 * Attach this to the leaf route that maps 1:1 to a backend endpoint, using the
 * exact permission that endpoint enforces — never a broader parent permission.
 * A parent/child route pair must not stack permissions (e.g. requiring
 * `SETOR_VISUALIZAR` on `/setores` AND `SETOR_CRIAR` on `/setores/novo`), or the
 * frontend ends up demanding more than the API does. Gate shared parent paths
 * with {@link permissionGuardAny} instead.
 */
export function permissionGuard(...required: PermissionCode[]): CanMatchFn {
  return (): boolean | UrlTree => authorize(required, (store) => store.hasAll(required));
}

/**
 * Deny-by-default gate for a parent path shared by leaves with different
 * permissions: it passes when the user holds AT LEAST ONE of the listed codes,
 * so it never adds a requirement on top of the leaf guard that actually matches
 * the backend endpoint. Each child route still declares its own
 * {@link permissionGuard}.
 */
export function permissionGuardAny(...anyOf: PermissionCode[]): CanMatchFn {
  return (): boolean | UrlTree => authorize(anyOf, (store) => store.hasAny(anyOf));
}

function authorize(
  codes: PermissionCode[],
  check: (store: AuthStore) => boolean,
): boolean | UrlTree {
  const store = inject(AuthStore);
  const router = inject(Router);
  const notifications = inject(NotificationService);

  if (!store.isAuthenticated()) {
    return router.createUrlTree(['/login']);
  }
  if (codes.length > 0 && check(store)) {
    return true;
  }
  notifications.warning('Você não tem permissão para acessar essa área.');
  return router.createUrlTree(['/']);
}
