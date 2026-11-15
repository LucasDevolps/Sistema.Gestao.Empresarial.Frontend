import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/auth/guards';
import { WORK_SCHEDULE_SCREENS } from '../../core/auth/screen-permissions';

export const WORK_SCHEDULES_ROUTES: Routes = [
  {
    path: '',
    canMatch: [permissionGuard(...WORK_SCHEDULE_SCREENS.view)],
    loadComponent: () =>
      import('./work-schedules-list.component').then((m) => m.WorkSchedulesListComponent),
  },
  {
    path: 'nova',
    canMatch: [permissionGuard(...WORK_SCHEDULE_SCREENS.create)],
    loadComponent: () =>
      import('./work-schedule-form.component').then((m) => m.WorkScheduleFormComponent),
  },
  {
    path: ':guid/editar',
    canMatch: [permissionGuard(...WORK_SCHEDULE_SCREENS.edit)],
    loadComponent: () =>
      import('./work-schedule-form.component').then((m) => m.WorkScheduleFormComponent),
  },
];
