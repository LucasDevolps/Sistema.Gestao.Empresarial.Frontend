import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/auth/guards';

export const EMPLOYEES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./employees-list.component').then((m) => m.EmployeesListComponent),
  },
  {
    path: 'novo',
    canMatch: [permissionGuard('FUNCIONARIO_CRIAR')],
    loadComponent: () =>
      import('./employee-form.component').then((m) => m.EmployeeFormComponent),
  },
  {
    path: ':employeeGuid',
    loadComponent: () =>
      import('./employee-detail.component').then((m) => m.EmployeeDetailComponent),
  },
  {
    path: ':employeeGuid/editar',
    canMatch: [permissionGuard('FUNCIONARIO_EDITAR')],
    loadComponent: () =>
      import('./employee-form.component').then((m) => m.EmployeeFormComponent),
  },
];
