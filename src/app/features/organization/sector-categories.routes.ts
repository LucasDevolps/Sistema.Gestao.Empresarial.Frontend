import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/auth/guards';
import { SECTOR_CATEGORY_SCREENS } from '../../core/auth/screen-permissions';

/**
 * Each route requires the full capability of the screen it opens
 * (see `screen-permissions.ts`): the list and the "editar" screen read a record
 * (`CATEGORIA_SETOR_VISUALIZAR`), and "editar" also writes it
 * (`CATEGORIA_SETOR_EDITAR`); "nova" has no read dependency, so it only needs
 * `CATEGORIA_SETOR_CRIAR`. The parent path in `app.routes.ts` only checks for
 * *some* category access.
 */
export const SECTOR_CATEGORIES_ROUTES: Routes = [
  {
    path: '',
    canMatch: [permissionGuard(...SECTOR_CATEGORY_SCREENS.view)],
    loadComponent: () =>
      import('./sector-categories-list.component').then((m) => m.SectorCategoriesListComponent),
  },
  {
    path: 'nova',
    canMatch: [permissionGuard(...SECTOR_CATEGORY_SCREENS.create)],
    loadComponent: () =>
      import('./sector-category-form.component').then((m) => m.SectorCategoryFormComponent),
  },
  {
    path: ':categoryGuid/editar',
    canMatch: [permissionGuard(...SECTOR_CATEGORY_SCREENS.edit)],
    loadComponent: () =>
      import('./sector-category-form.component').then((m) => m.SectorCategoryFormComponent),
  },
];
