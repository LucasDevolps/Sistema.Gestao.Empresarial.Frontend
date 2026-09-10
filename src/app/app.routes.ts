import { Routes } from '@angular/router';
import { authGuard, guestGuard, permissionGuard } from './core/auth/guards';

/**
 * Route map. Every protected feature is lazy-loaded and gated by `authGuard`
 * plus a `permissionGuard(...)` that lists the real backend permission codes.
 * No feature exists without a real endpoint behind it.
 */
export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/login.component').then((m) => m.LoginComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell.component').then((m) => m.ShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'inicio' },
      {
        path: 'inicio',
        loadComponent: () => import('./features/home/home.component').then((m) => m.HomeComponent),
      },
      {
        path: 'funcionarios',
        canMatch: [permissionGuard('FUNCIONARIO_VISUALIZAR')],
        loadChildren: () =>
          import('./features/employees/employees.routes').then((m) => m.EMPLOYEES_ROUTES),
      },
      {
        path: 'profissoes',
        canMatch: [permissionGuard('PROFISSAO_VISUALIZAR')],
        loadChildren: () =>
          import('./features/catalogs/professions.routes').then((m) => m.PROFESSIONS_ROUTES),
      },
      {
        path: 'cargos',
        canMatch: [permissionGuard('CARGO_VISUALIZAR')],
        loadChildren: () =>
          import('./features/catalogs/positions.routes').then((m) => m.POSITIONS_ROUTES),
      },
      {
        path: 'niveis-profissionais',
        canMatch: [permissionGuard('NIVEL_PROFISSIONAL_VISUALIZAR')],
        loadComponent: () =>
          import('./features/catalogs/professional-levels.component').then(
            (m) => m.ProfessionalLevelsComponent,
          ),
      },
      {
        path: 'unidades-hospitalares',
        canMatch: [permissionGuard('FUNCIONARIO_VISUALIZAR')],
        loadChildren: () =>
          import('./features/organization/hospital-units.routes').then((m) => m.HOSPITAL_UNITS_ROUTES),
      },
      {
        path: 'setores',
        canMatch: [permissionGuard('SETOR_VISUALIZAR')],
        loadChildren: () =>
          import('./features/organization/sectors.routes').then((m) => m.SECTORS_ROUTES),
      },
      {
        path: 'categorias-setor',
        canMatch: [permissionGuard('CATEGORIA_SETOR_VISUALIZAR')],
        loadChildren: () =>
          import('./features/organization/sector-categories.routes').then(
            (m) => m.SECTOR_CATEGORIES_ROUTES,
          ),
      },
      {
        path: 'usuarios',
        canMatch: [permissionGuard('USUARIO_GERENCIAR_PERMISSOES')],
        loadChildren: () => import('./features/users/users.routes').then((m) => m.USERS_ROUTES),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
