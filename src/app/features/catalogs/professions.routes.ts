import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/auth/guards';

export const PROFESSIONS_ROUTES: Routes = [
  {
    path: '',
    data: { kind: 'profession' },
    loadComponent: () => import('./catalog-list.component').then((m) => m.CatalogListComponent),
  },
  {
    path: 'novo',
    canMatch: [permissionGuard('PROFISSAO_CRIAR')],
    data: { kind: 'profession' },
    loadComponent: () => import('./catalog-form.component').then((m) => m.CatalogFormComponent),
  },
  {
    path: ':guid/editar',
    canMatch: [permissionGuard('PROFISSAO_EDITAR')],
    data: { kind: 'profession' },
    loadComponent: () => import('./catalog-form.component').then((m) => m.CatalogFormComponent),
  },
];
