import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/auth/guards';

export const SECTORS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./sectors-list.component').then((m) => m.SectorsListComponent),
  },
  {
    path: 'novo',
    canMatch: [permissionGuard('SETOR_CRIAR')],
    loadComponent: () => import('./sector-form.component').then((m) => m.SectorFormComponent),
  },
  {
    path: ':sectorGuid/editar',
    canMatch: [permissionGuard('SETOR_EDITAR')],
    loadComponent: () => import('./sector-form.component').then((m) => m.SectorFormComponent),
  },
  {
    path: ':sectorGuid',
    loadComponent: () => import('./sector-detail.component').then((m) => m.SectorDetailComponent),
  },
];
