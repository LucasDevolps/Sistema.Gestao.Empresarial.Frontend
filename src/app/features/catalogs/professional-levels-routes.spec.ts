import { TestBed } from '@angular/core/testing';
import { CanMatchFn, Route, UrlSegment, UrlTree, provideRouter } from '@angular/router';
import { routes as appRoutes } from '../../app.routes';
import { AuthStore } from '../../core/auth/auth-store';
import { PROFESSIONAL_LEVEL_SCREENS } from '../../core/auth/screen-permissions';
import { CurrentUserResponse } from '../../core/models/auth.models';
import { PROFESSIONAL_LEVELS_ROUTES } from './professional-levels.routes';

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
  const feature = shell?.children?.find((r) => r.path === 'niveis-profissionais');
  if (!feature) {
    throw new Error('route "niveis-profissionais" not found in app.routes');
  }
  return feature;
}

function leaf(path: string): Route {
  const found = PROFESSIONAL_LEVELS_ROUTES.find((r) => r.path === path);
  if (!found) {
    throw new Error(`route "${path}" not found`);
  }
  return found;
}

describe('professional level routes — guards match the backend endpoints', () => {
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
    expect(PROFESSIONAL_LEVEL_SCREENS.view).toEqual(['NIVEL_PROFISSIONAL_VISUALIZAR']);
    expect(PROFESSIONAL_LEVEL_SCREENS.create).toEqual(['NIVEL_PROFISSIONAL_CRIAR']);
    expect(PROFESSIONAL_LEVEL_SCREENS.edit).toEqual([
      'NIVEL_PROFISSIONAL_VISUALIZAR',
      'NIVEL_PROFISSIONAL_EDITAR',
    ]);
    expect(PROFESSIONAL_LEVEL_SCREENS.delete).toEqual([
      'NIVEL_PROFISSIONAL_VISUALIZAR',
      'NIVEL_PROFISSIONAL_EDITAR',
    ]);
  });

  it('the parent path matches for any single level permission and blocks without one', () => {
    store.setIdentity(identity(['NIVEL_PROFISSIONAL_CRIAR']));
    expect(allows(parentRoute())).toBe(true);

    store.setIdentity(identity(['PROFISSAO_VISUALIZAR']));
    expect(blocks(parentRoute())).toBe(true);
  });

  it('the list needs NIVEL_PROFISSIONAL_VISUALIZAR', () => {
    store.setIdentity(identity(['NIVEL_PROFISSIONAL_CRIAR', 'NIVEL_PROFISSIONAL_EDITAR']));
    expect(blocks(leaf(''))).toBe(true);

    store.setIdentity(identity(['NIVEL_PROFISSIONAL_VISUALIZAR']));
    expect(allows(leaf(''))).toBe(true);
  });

  it('"novo" needs only NIVEL_PROFISSIONAL_CRIAR', () => {
    store.setIdentity(identity(['NIVEL_PROFISSIONAL_VISUALIZAR', 'NIVEL_PROFISSIONAL_EDITAR']));
    expect(blocks(leaf('novo'))).toBe(true);

    store.setIdentity(identity(['NIVEL_PROFISSIONAL_CRIAR']));
    expect(allows(leaf('novo'))).toBe(true);
  });

  it('"editar" needs VISUALIZAR + EDITAR', () => {
    store.setIdentity(identity(['NIVEL_PROFISSIONAL_EDITAR']));
    expect(blocks(leaf(':guid/editar'))).toBe(true);

    store.setIdentity(identity(['NIVEL_PROFISSIONAL_VISUALIZAR']));
    expect(blocks(leaf(':guid/editar'))).toBe(true);

    store.setIdentity(identity([...PROFESSIONAL_LEVEL_SCREENS.edit]));
    expect(allows(leaf(':guid/editar'))).toBe(true);
  });
});
