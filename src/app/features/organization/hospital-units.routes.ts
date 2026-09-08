import { Routes } from '@angular/router';

export const HOSPITAL_UNITS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./hospital-units-list.component').then((m) => m.HospitalUnitsListComponent),
  },
  {
    path: ':unitGuid',
    loadComponent: () =>
      import('./hospital-unit-detail.component').then((m) => m.HospitalUnitDetailComponent),
  },
];
