import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/auth/guards';

/**
 * Each route carries the exact permission its backend endpoint enforces
 * (`SectorCategoriesController`): list → `CATEGORIA_SETOR_VISUALIZAR`,
 * create → `CATEGORIA_SETOR_CRIAR`, update/status → `CATEGORIA_SETOR_EDITAR`.
 * The parent path in `app.routes.ts` only checks for *some* category access, so
 * `CATEGORIA_SETOR_VISUALIZAR` is never forced as a prerequisite for creating.
 */
export const SECTOR_CATEGORIES_ROUTES: Routes = [
  {
    path: '',
    canMatch: [permissionGuard('CATEGORIA_SETOR_VISUALIZAR')],
    loadComponent: () =>
      import('./sector-categories-list.component').then((m) => m.SectorCategoriesListComponent),
  },
  {
    path: 'nova',
    canMatch: [permissionGuard('CATEGORIA_SETOR_CRIAR')],
    loadComponent: () =>
      import('./sector-category-form.component').then((m) => m.SectorCategoryFormComponent),
  },
  {
    path: ':categoryGuid/editar',
    canMatch: [permissionGuard('CATEGORIA_SETOR_EDITAR')],
    loadComponent: () =>
      import('./sector-category-form.component').then((m) => m.SectorCategoryFormComponent),
  },
];
