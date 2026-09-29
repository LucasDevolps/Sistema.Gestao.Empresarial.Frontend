import { TestBed } from '@angular/core/testing';
import { CanMatchFn, Route, Router, UrlSegment, UrlTree, provideRouter } from '@angular/router';
import { routes as appRoutes } from '../../app.routes';
import { AuthStore } from '../../core/auth/auth-store';
import { HOSPITAL_UNIT_SCREENS } from '../../core/auth/screen-permissions';
import { CurrentUserResponse } from '../../core/models/auth.models';
import { HOSPITAL_UNITS_ROUTES } from './hospital-units.routes';

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
  const route = shell?.children?.find((r) => r.path === 'unidades-hospitalares');
  if (!route) {
    throw new Error('route "unidades-hospitalares" not found');
  }
  return route;
}

function leaf(path: string): Route {
  const route = HOSPITAL_UNITS_ROUTES.find((r) => r.path === path);
  if (!route) {
    throw new Error(`route "${path}" not found`);
  }
  return route;
}

describe('hospital unit routes — guards follow the screen capabilities', () => {
  let store: AuthStore;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    store = TestBed.inject(AuthStore);
  });

  function allows(route: Route): boolean {
    const guards = (route.canMatch ?? []) as CanMatchFn[];
    return TestBed.runInInjectionContext(() =>
      guards.every((guard) => guard(route, [] as UrlSegment[]) === true),
    );
  }

  it('pins the capability sets to the backend endpoints of PR #101', () => {
    expect(HOSPITAL_UNIT_SCREENS.view).toEqual(['UNIDADE_HOSPITALAR_VISUALIZAR']);
    expect(HOSPITAL_UNIT_SCREENS.create).toEqual(['UNIDADE_HOSPITALAR_CRIAR']);
    expect(HOSPITAL_UNIT_SCREENS.edit).toEqual([
      'UNIDADE_HOSPITALAR_VISUALIZAR',
      'UNIDADE_HOSPITALAR_EDITAR',
    ]);
    expect(HOSPITAL_UNIT_SCREENS.status).toEqual([
      'UNIDADE_HOSPITALAR_VISUALIZAR',
      'UNIDADE_HOSPITALAR_EDITAR',
    ]);
    expect(HOSPITAL_UNIT_SCREENS.lookup).toEqual(['UNIDADE_HOSPITALAR_VISUALIZAR']);
  });

  it('declares "novo" before ":unitGuid" so it is never read as a Guid', () => {
    const paths = HOSPITAL_UNITS_ROUTES.map((r) => r.path);
    expect(paths.indexOf('novo')).toBeLessThan(paths.indexOf(':unitGuid'));
    expect(paths.indexOf(':unitGuid/editar')).toBeLessThan(paths.indexOf(':unitGuid'));
  });

  it('FUNCIONARIO_VISUALIZAR no longer opens /unidades-hospitalares', () => {
    store.setIdentity(identity(['FUNCIONARIO_VISUALIZAR']));
    expect(allows(parentRoute())).toBeFalse();
  });

  it('the parent path accepts any single hospital-unit permission', () => {
    for (const code of [
      'UNIDADE_HOSPITALAR_VISUALIZAR',
      'UNIDADE_HOSPITALAR_CRIAR',
      'UNIDADE_HOSPITALAR_EDITAR',
    ]) {
      store.setIdentity(identity([code]));
      expect(allows(parentRoute())).withContext(code).toBeTrue();
    }
  });

  it('view-only: list and detail yes; novo and editar no', () => {
    store.setIdentity(identity(['UNIDADE_HOSPITALAR_VISUALIZAR']));
    expect(allows(leaf(''))).toBeTrue();
    expect(allows(leaf(':unitGuid'))).toBeTrue();
    expect(allows(leaf('novo'))).toBeFalse();
    expect(allows(leaf(':unitGuid/editar'))).toBeFalse();
  });

  it('create-only: novo yes (the form has no mandatory read dependency)', () => {
    store.setIdentity(identity(['UNIDADE_HOSPITALAR_CRIAR']));
    expect(allows(leaf('novo'))).toBeTrue();
    expect(allows(leaf(''))).toBeFalse();
    expect(allows(leaf(':unitGuid/editar'))).toBeFalse();
  });

  it('editar needs VISUALIZAR + EDITAR (the PUT replaces what the GET loaded)', () => {
    store.setIdentity(identity(['UNIDADE_HOSPITALAR_EDITAR']));
    expect(allows(leaf(':unitGuid/editar'))).toBeFalse();
    store.setIdentity(identity(['UNIDADE_HOSPITALAR_VISUALIZAR', 'UNIDADE_HOSPITALAR_EDITAR']));
    expect(allows(leaf(':unitGuid/editar'))).toBeTrue();
    expect(allows(leaf('novo'))).toBeFalse();
  });

  it('sends an anonymous user to /login from every leaf', () => {
    const router = TestBed.inject(Router);
    for (const route of HOSPITAL_UNITS_ROUTES) {
      const guard = (route.canMatch ?? [])[0] as CanMatchFn;
      const result = TestBed.runInInjectionContext(() => guard(route, [] as UrlSegment[]));
      expect(result instanceof UrlTree).toBeTrue();
      expect(router.serializeUrl(result as UrlTree)).toBe('/login');
    }
  });
});
