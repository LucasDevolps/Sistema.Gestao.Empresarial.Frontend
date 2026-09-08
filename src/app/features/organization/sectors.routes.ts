import { Routes } from '@angular/router';

export const SECTORS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./sectors-list.component').then((m) => m.SectorsListComponent),
  },
  {
    path: ':sectorGuid',
    loadComponent: () => import('./sector-detail.component').then((m) => m.SectorDetailComponent),
  },
];
