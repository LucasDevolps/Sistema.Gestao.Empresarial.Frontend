import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/auth/guards';
import { SECTOR_SCREENS } from '../../core/auth/screen-permissions';

/**
 * Each route requires the full capability of the screen it opens, not just the
 * permission of its write endpoint (see `screen-permissions.ts`): list/detail
 * only read, but "novo" and "editar" also load the unit and category catalogs,
 * so the guard demands those read permissions up front instead of letting the
 * user reach a form that cannot populate itself. The `/setores` parent path in
 * `app.routes.ts` still only checks for *some* sector access.
 */
export const SECTORS_ROUTES: Routes = [
  {
    path: '',
    canMatch: [permissionGuard(...SECTOR_SCREENS.view)],
    loadComponent: () => import('./sectors-list.component').then((m) => m.SectorsListComponent),
  },
  {
    path: 'novo',
    canMatch: [permissionGuard(...SECTOR_SCREENS.create)],
    loadComponent: () => import('./sector-form.component').then((m) => m.SectorFormComponent),
  },
  {
    path: ':sectorGuid/editar',
    canMatch: [permissionGuard(...SECTOR_SCREENS.edit)],
    loadComponent: () => import('./sector-form.component').then((m) => m.SectorFormComponent),
  },
  {
    path: ':sectorGuid',
    canMatch: [permissionGuard(...SECTOR_SCREENS.view)],
    loadComponent: () => import('./sector-detail.component').then((m) => m.SectorDetailComponent),
  },
];
