import { TestBed } from '@angular/core/testing';
import { CanMatchFn, Route, Routes, UrlSegment, UrlTree, provideRouter } from '@angular/router';
import { CurrentUserResponse } from '../../core/models/auth.models';
import { AuthStore } from '../../core/auth/auth-store';
import { routes as appRoutes } from '../../app.routes';
import { SECTORS_ROUTES } from './sectors.routes';
import { SECTOR_CATEGORIES_ROUTES } from './sector-categories.routes';

/**
 * The frontend guards must reproduce — never widen — the authorization the
 * backend enforces. `POST /api/setores` requires only `SETOR_CRIAR`, so a user
 * holding just that code must be able to match `/setores/novo`; the shared
 * `/setores` parent path must not add `SETOR_VISUALIZAR` on top.
 */
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

function featureRoute(path: string): Route {
  const shell = appRoutes.find((r) => r.path === '' && r.children);
  const feature = shell?.children?.find((r) => r.path === path);
  if (!feature) {
    throw new Error(`route "${path}" not found in app.routes`);
  }
  return feature;
}

function leaf(routes: Routes, path: string): Route {
  const found = routes.find((r) => r.path === path);
  if (!found) {
    throw new Error(`route "${path}" not found`);
  }
  return found;
}

describe('sector routes — permissions mirror the backend, without stacking', () => {
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

  // ---- parent path only checks for *some* access -------------------------

  it('/setores parent matches for a user with only SETOR_CRIAR', () => {
    store.setIdentity(identity(['SETOR_CRIAR']));
    expect(allows(featureRoute('setores'))).toBe(true);
  });

  it('/setores parent is blocked for a user with no sector permission at all', () => {
    store.setIdentity(identity(['FUNCIONARIO_VISUALIZAR']));
    expect(blocks(featureRoute('setores'))).toBe(true);
  });

  it('/categorias-setor parent matches for a user with only CATEGORIA_SETOR_CRIAR', () => {
    store.setIdentity(identity(['CATEGORIA_SETOR_CRIAR']));
    expect(allows(featureRoute('categorias-setor'))).toBe(true);
  });

  // ---- sector leaves use the exact endpoint permission -----------------

  it('a user with SETOR_CRIAR (and not SETOR_VISUALIZAR) can reach /setores/novo', () => {
    store.setIdentity(identity(['SETOR_CRIAR']));
    expect(allows(leaf(SECTORS_ROUTES, 'novo'))).toBe(true);
  });

  it('a user without SETOR_CRIAR cannot reach /setores/novo', () => {
    store.setIdentity(identity(['SETOR_VISUALIZAR', 'SETOR_EDITAR']));
    expect(blocks(leaf(SECTORS_ROUTES, 'novo'))).toBe(true);
  });

  it('editing a sector requires SETOR_EDITAR', () => {
    store.setIdentity(identity(['SETOR_EDITAR']));
    expect(allows(leaf(SECTORS_ROUTES, ':sectorGuid/editar'))).toBe(true);

    store.setIdentity(identity(['SETOR_VISUALIZAR', 'SETOR_CRIAR']));
    expect(blocks(leaf(SECTORS_ROUTES, ':sectorGuid/editar'))).toBe(true);
  });

  it('the list and detail leaves require SETOR_VISUALIZAR', () => {
    store.setIdentity(identity(['SETOR_CRIAR']));
    expect(blocks(leaf(SECTORS_ROUTES, ''))).toBe(true);
    expect(blocks(leaf(SECTORS_ROUTES, ':sectorGuid'))).toBe(true);

    store.setIdentity(identity(['SETOR_VISUALIZAR']));
    expect(allows(leaf(SECTORS_ROUTES, ''))).toBe(true);
    expect(allows(leaf(SECTORS_ROUTES, ':sectorGuid'))).toBe(true);
  });

  // ---- category leaves ------------------------------------------------

  it('category leaves use CATEGORIA_SETOR_VISUALIZAR / CRIAR / EDITAR respectively', () => {
    store.setIdentity(identity(['CATEGORIA_SETOR_VISUALIZAR']));
    expect(allows(leaf(SECTOR_CATEGORIES_ROUTES, ''))).toBe(true);
    expect(blocks(leaf(SECTOR_CATEGORIES_ROUTES, 'nova'))).toBe(true);
    expect(blocks(leaf(SECTOR_CATEGORIES_ROUTES, ':categoryGuid/editar'))).toBe(true);

    store.setIdentity(identity(['CATEGORIA_SETOR_CRIAR']));
    expect(allows(leaf(SECTOR_CATEGORIES_ROUTES, 'nova'))).toBe(true);

    store.setIdentity(identity(['CATEGORIA_SETOR_EDITAR']));
    expect(allows(leaf(SECTOR_CATEGORIES_ROUTES, ':categoryGuid/editar'))).toBe(true);
  });

  // ---- no invented permissions -------------------------------------------

  it('every sector/category route guard references only real backend codes', () => {
    const known = new Set([
      'SETOR_VISUALIZAR',
      'SETOR_CRIAR',
      'SETOR_EDITAR',
      'CATEGORIA_SETOR_VISUALIZAR',
      'CATEGORIA_SETOR_CRIAR',
      'CATEGORIA_SETOR_EDITAR',
      'FUNCIONARIO_VISUALIZAR',
    ]);
    // A guard only returns `true` when the held codes satisfy it; feeding it the
    // full known set must always pass. A guard keyed on a fictional code would
    // stay blocked and fail this assertion.
    store.setIdentity(identity([...known]));
    for (const route of [...SECTORS_ROUTES, ...SECTOR_CATEGORIES_ROUTES]) {
      expect(allows(route)).toBe(true);
    }
  });
});
