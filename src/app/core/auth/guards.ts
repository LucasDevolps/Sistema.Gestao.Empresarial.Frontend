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
 * Deny-by-default authorization gate. The required codes are declared on the
 * route (`data.permissions`); if any is missing the navigation is refused.
 */
export function permissionGuard(...required: PermissionCode[]): CanMatchFn {
  return (): boolean | UrlTree => {
    const store = inject(AuthStore);
    const router = inject(Router);
    const notifications = inject(NotificationService);

    if (!store.isAuthenticated()) {
      return router.createUrlTree(['/login']);
    }
    if (store.hasAll(required)) {
      return true;
    }
    notifications.warning('Você não tem permissão para acessar essa área.');
    return router.createUrlTree(['/']);
  };
}
