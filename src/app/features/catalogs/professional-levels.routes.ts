import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/auth/guards';
import { PROFESSIONAL_LEVEL_SCREENS } from '../../core/auth/screen-permissions';

/**
 * Each route requires the full capability of the screen it opens
 * (see `screen-permissions.ts`): the list reads (`NIVEL_PROFISSIONAL_VISUALIZAR`),
 * "novo" only writes (`NIVEL_PROFISSIONAL_CRIAR`) and "editar" reads + writes
 * (`NIVEL_PROFISSIONAL_VISUALIZAR` + `NIVEL_PROFISSIONAL_EDITAR`). The parent path
 * in `app.routes.ts` only checks for *some* level access.
 */
export const PROFESSIONAL_LEVELS_ROUTES: Routes = [
  {
    path: '',
    canMatch: [permissionGuard(...PROFESSIONAL_LEVEL_SCREENS.view)],
    loadComponent: () =>
      import('./professional-levels.component').then((m) => m.ProfessionalLevelsComponent),
  },
  {
    path: 'novo',
    canMatch: [permissionGuard(...PROFESSIONAL_LEVEL_SCREENS.create)],
    loadComponent: () =>
      import('./professional-level-form.component').then((m) => m.ProfessionalLevelFormComponent),
  },
  {
    path: ':guid/editar',
    canMatch: [permissionGuard(...PROFESSIONAL_LEVEL_SCREENS.edit)],
    loadComponent: () =>
      import('./professional-level-form.component').then((m) => m.ProfessionalLevelFormComponent),
  },
];
