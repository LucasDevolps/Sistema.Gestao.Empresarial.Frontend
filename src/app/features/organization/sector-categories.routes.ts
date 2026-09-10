import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/auth/guards';

export const SECTOR_CATEGORIES_ROUTES: Routes = [
  {
    path: '',
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
