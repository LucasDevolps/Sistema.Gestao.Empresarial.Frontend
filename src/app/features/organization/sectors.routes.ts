import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/auth/guards';

/**
 * Each route carries the exact permission its backend endpoint enforces
 * (`SectorsController`): list/detail → `SETOR_VISUALIZAR`, create → `SETOR_CRIAR`,
 * update/status/served-units → `SETOR_EDITAR`. Guards are declared per leaf so a
 * user with only `SETOR_CRIAR` can still reach `/setores/novo` — the parent path
 * in `app.routes.ts` only checks for *some* sector access.
 */
export const SECTORS_ROUTES: Routes = [
  {
    path: '',
    canMatch: [permissionGuard('SETOR_VISUALIZAR')],
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
    canMatch: [permissionGuard('SETOR_VISUALIZAR')],
    loadComponent: () => import('./sector-detail.component').then((m) => m.SectorDetailComponent),
  },
];
