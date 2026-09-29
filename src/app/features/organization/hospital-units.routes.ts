import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/auth/guards';
import { HOSPITAL_UNIT_SCREENS } from '../../core/auth/screen-permissions';

/**
 * Each leaf requires the capability of the screen it opens (see
 * `screen-permissions.ts`). `novo` is declared before `:unitGuid` so it is never
 * matched as a Guid; `:unitGuid/editar` is more specific than `:unitGuid`. The
 * `/unidades-hospitalares` parent in `app.routes.ts` only checks for *some*
 * hospital-unit access.
 */
export const HOSPITAL_UNITS_ROUTES: Routes = [
  {
    path: '',
    canMatch: [permissionGuard(...HOSPITAL_UNIT_SCREENS.view)],
    loadComponent: () =>
      import('./hospital-units-list.component').then((m) => m.HospitalUnitsListComponent),
  },
  {
    path: 'novo',
    canMatch: [permissionGuard(...HOSPITAL_UNIT_SCREENS.create)],
    loadComponent: () =>
      import('./hospital-unit-form.component').then((m) => m.HospitalUnitFormComponent),
  },
  {
    path: ':unitGuid/editar',
    canMatch: [permissionGuard(...HOSPITAL_UNIT_SCREENS.edit)],
    loadComponent: () =>
      import('./hospital-unit-form.component').then((m) => m.HospitalUnitFormComponent),
  },
  {
    path: ':unitGuid',
    canMatch: [permissionGuard(...HOSPITAL_UNIT_SCREENS.view)],
    loadComponent: () =>
      import('./hospital-unit-detail.component').then((m) => m.HospitalUnitDetailComponent),
  },
];
