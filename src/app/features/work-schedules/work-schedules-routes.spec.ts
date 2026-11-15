import { TestBed } from '@angular/core/testing';
import { CanMatchFn, Route, UrlSegment, UrlTree, provideRouter } from '@angular/router';
import { routes as appRoutes } from '../../app.routes';
import { AuthStore } from '../../core/auth/auth-store';
import { WORK_SCHEDULE_SCREENS } from '../../core/auth/screen-permissions';
import { CurrentUserResponse } from '../../core/models/auth.models';
import { WORK_SCHEDULES_ROUTES } from './work-schedules.routes';

function identity(permissions: string[]): CurrentUserResponse {
  return {
    userGuid: '1',
    email: 'u@h.test',
    active: true,
    permissionVersion: 1,
    employee: null,
    organization: null,
    hiringUnit: null,
    permissions,
  };
}

function parentRoute(): Route {
  const shell = appRoutes.find((r) => r.path === '' && r.children);
  const feature = shell?.children?.find((r) => r.path === 'jornadas-trabalho');
  if (!feature) {
    throw new Error('route "jornadas-trabalho" not found in app.routes');
  }
  return feature;
}

function leaf(path: string): Route {
  const found = WORK_SCHEDULES_ROUTES.find((r) => r.path === path);
  if (!found) {
    throw new Error(`route "${path}" not found`);
  }
  return found;
}

describe('work schedule routes — guards match the backend endpoints', () => {
  let store: AuthStore;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    store = TestBed.inject(AuthStore);
  });

  function allows(route: Route): boolean {
    const guards = (route.canMatch ?? []) as CanMatchFn[];
    return TestBed.runInInjectionContext(() =>
      guards.every((g) => g(route, [] as UrlSegment[]) === true),
    );
  }

  function blocks(route: Route): boolean {
    const guards = (route.canMatch ?? []) as CanMatchFn[];
    return TestBed.runInInjectionContext(() =>
      guards.some((g) => {
        const result = g(route, [] as UrlSegment[]);
        return result === false || result instanceof UrlTree;
      }),
    );
  }

  it('pins the screen capabilities to the backend permissions', () => {
    expect(WORK_SCHEDULE_SCREENS.view).toEqual(['JORNADA_TRABALHO_VISUALIZAR']);
    expect(WORK_SCHEDULE_SCREENS.create).toEqual(['JORNADA_TRABALHO_CRIAR']);
    expect(WORK_SCHEDULE_SCREENS.edit).toEqual([
      'JORNADA_TRABALHO_VISUALIZAR',
      'JORNADA_TRABALHO_EDITAR',
    ]);
    expect(WORK_SCHEDULE_SCREENS.status).toEqual([
      'JORNADA_TRABALHO_VISUALIZAR',
      'JORNADA_TRABALHO_EDITAR',
    ]);
  });

  it('the parent path matches for any single schedule permission and blocks without one', () => {
    store.setIdentity(identity(['JORNADA_TRABALHO_CRIAR']));
    expect(allows(parentRoute())).toBe(true);

    store.setIdentity(identity(['SETOR_VISUALIZAR']));
    expect(blocks(parentRoute())).toBe(true);
  });

  it('the list needs JORNADA_TRABALHO_VISUALIZAR', () => {
    store.setIdentity(identity(['JORNADA_TRABALHO_CRIAR', 'JORNADA_TRABALHO_EDITAR']));
    expect(blocks(leaf(''))).toBe(true);

    store.setIdentity(identity(['JORNADA_TRABALHO_VISUALIZAR']));
    expect(allows(leaf(''))).toBe(true);
  });

  it('"nova" needs only JORNADA_TRABALHO_CRIAR', () => {
    store.setIdentity(identity(['JORNADA_TRABALHO_VISUALIZAR', 'JORNADA_TRABALHO_EDITAR']));
    expect(blocks(leaf('nova'))).toBe(true);

    store.setIdentity(identity(['JORNADA_TRABALHO_CRIAR']));
    expect(allows(leaf('nova'))).toBe(true);
  });

  it('"editar" needs VISUALIZAR + EDITAR', () => {
    store.setIdentity(identity(['JORNADA_TRABALHO_EDITAR']));
    expect(blocks(leaf(':guid/editar'))).toBe(true);

    store.setIdentity(identity(['JORNADA_TRABALHO_VISUALIZAR']));
    expect(blocks(leaf(':guid/editar'))).toBe(true);

    store.setIdentity(identity([...WORK_SCHEDULE_SCREENS.edit]));
    expect(allows(leaf(':guid/editar'))).toBe(true);
  });
});
