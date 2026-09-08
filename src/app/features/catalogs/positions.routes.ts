import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/auth/guards';

export const POSITIONS_ROUTES: Routes = [
  {
    path: '',
    data: { kind: 'position' },
    loadComponent: () => import('./catalog-list.component').then((m) => m.CatalogListComponent),
  },
  {
    path: 'novo',
    canMatch: [permissionGuard('CARGO_CRIAR')],
    data: { kind: 'position' },
    loadComponent: () => import('./catalog-form.component').then((m) => m.CatalogFormComponent),
  },
  {
    path: ':guid/editar',
    canMatch: [permissionGuard('CARGO_EDITAR')],
    data: { kind: 'position' },
    loadComponent: () => import('./catalog-form.component').then((m) => m.CatalogFormComponent),
  },
];
