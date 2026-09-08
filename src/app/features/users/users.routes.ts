import { Routes } from '@angular/router';

export const USERS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./users-list.component').then((m) => m.UsersListComponent),
  },
  {
    path: ':userGuid/permissoes',
    loadComponent: () =>
      import('./user-permissions.component').then((m) => m.UserPermissionsComponent),
  },
];
