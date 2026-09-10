import { TestBed } from '@angular/core/testing';
import {
  CanMatchFn,
  Route,
  Router,
  Routes,
  UrlSegment,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { CurrentUserResponse } from '../../core/models/auth.models';
import { AuthStore } from '../../core/auth/auth-store';
import { SECTOR_CATEGORY_SCREENS, SECTOR_SCREENS } from '../../core/auth/screen-permissions';
import { routes as appRoutes } from '../../app.routes';
import { SECTORS_ROUTES } from './sectors.routes';
import { SECTOR_CATEGORIES_ROUTES } from './sector-categories.routes';

/**
 * Route guards must reproduce the authorization needed for the *whole screen* to
 * work — every endpoint it depends on — not just the write endpoint. The "novo"
 * and "editar" screens load the unit/category catalogs, so their guards demand
 * those read permissions too.
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

/** Every subset of `codes` with exactly one element removed. */
function withoutEach(codes: readonly string[]): { missing: string; rest: string[] }[] {
  return codes.map((missing) => ({
    missing,
    rest: codes.filter((code) => code !== missing),
  }));
}

describe('sector routes — guards require the full screen capability', () => {
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

  // ---- the capability map matches the backend endpoints -----------------

  it('screen-permission constants only reference real PermissionCode values', () => {
    // `screen-permissions.ts` uses `satisfies Record<string, readonly PermissionCode[]>`,
    // so a fictional code would already be a compile error; this pins the sets.
    expect(SECTOR_SCREENS.view).toEqual(['SETOR_VISUALIZAR']);
    expect(SECTOR_SCREENS.create).toEqual([
      'SETOR_CRIAR',
      'FUNCIONARIO_VISUALIZAR',
      'CATEGORIA_SETOR_VISUALIZAR',
    ]);
    expect(SECTOR_SCREENS.edit).toEqual([
      'SETOR_VISUALIZAR',
      'SETOR_EDITAR',
      'CATEGORIA_SETOR_VISUALIZAR',
    ]);
    expect(SECTOR_CATEGORY_SCREENS.view).toEqual(['CATEGORIA_SETOR_VISUALIZAR']);
    expect(SECTOR_CATEGORY_SCREENS.create).toEqual(['CATEGORIA_SETOR_CRIAR']);
    expect(SECTOR_CATEGORY_SCREENS.edit).toEqual([
      'CATEGORIA_SETOR_VISUALIZAR',
      'CATEGORIA_SETOR_EDITAR',
    ]);
  });

  // ---- parent path only checks for *some* access -----------------------

  it('/setores parent matches for any single sector permission', () => {
    store.setIdentity(identity(['SETOR_CRIAR']));
    expect(allows(featureRoute('setores'))).toBe(true);
  });

  it('/setores parent is blocked with no sector permission at all', () => {
    store.setIdentity(identity(['FUNCIONARIO_VISUALIZAR']));
    expect(blocks(featureRoute('setores'))).toBe(true);
  });

  it('/categorias-setor parent matches for any single category permission', () => {
    store.setIdentity(identity(['CATEGORIA_SETOR_CRIAR']));
    expect(allows(featureRoute('categorias-setor'))).toBe(true);
  });

  // ---- create sector: needs write + both catalogs ---------------------

  it('grants /setores/novo with the full create capability', () => {
    store.setIdentity(identity([...SECTOR_SCREENS.create]));
    expect(allows(leaf(SECTORS_ROUTES, 'novo'))).toBe(true);
  });

  it('blocks /setores/novo when any one create permission is missing', () => {
    for (const { missing, rest } of withoutEach(SECTOR_SCREENS.create)) {
      store.setIdentity(identity(rest));
      expect(blocks(leaf(SECTORS_ROUTES, 'novo')))
        .withContext(`missing ${missing}`)
        .toBe(true);
    }
  });

  // ---- edit sector: read state + write + category catalog ------------

  it('grants /setores/:guid/editar with the full edit capability', () => {
    store.setIdentity(identity([...SECTOR_SCREENS.edit]));
    expect(allows(leaf(SECTORS_ROUTES, ':sectorGuid/editar'))).toBe(true);
  });

  it('blocks /setores/:guid/editar when SETOR_VISUALIZAR, SETOR_EDITAR or CATEGORIA_SETOR_VISUALIZAR is missing', () => {
    for (const { missing, rest } of withoutEach(SECTOR_SCREENS.edit)) {
      store.setIdentity(identity(rest));
      expect(blocks(leaf(SECTORS_ROUTES, ':sectorGuid/editar')))
        .withContext(`missing ${missing}`)
        .toBe(true);
    }
  });

  it('does not require FUNCIONARIO_VISUALIZAR to edit a sector (staff list is optional)', () => {
    store.setIdentity(identity([...SECTOR_SCREENS.edit])); // no FUNCIONARIO_VISUALIZAR
    expect(allows(leaf(SECTORS_ROUTES, ':sectorGuid/editar'))).toBe(true);
  });

  // ---- view leaves unchanged ----------------------------------------

  it('list and detail require only SETOR_VISUALIZAR', () => {
    store.setIdentity(identity(['SETOR_CRIAR', 'FUNCIONARIO_VISUALIZAR', 'CATEGORIA_SETOR_VISUALIZAR']));
    expect(blocks(leaf(SECTORS_ROUTES, ''))).toBe(true);
    expect(blocks(leaf(SECTORS_ROUTES, ':sectorGuid'))).toBe(true);

    store.setIdentity(identity(['SETOR_VISUALIZAR']));
    expect(allows(leaf(SECTORS_ROUTES, ''))).toBe(true);
    expect(allows(leaf(SECTORS_ROUTES, ':sectorGuid'))).toBe(true);
  });

  // ---- categories --------------------------------------------------

  it('creating a category needs only CATEGORIA_SETOR_CRIAR (no read dependency)', () => {
    store.setIdentity(identity(['CATEGORIA_SETOR_CRIAR']));
    expect(allows(leaf(SECTOR_CATEGORIES_ROUTES, 'nova'))).toBe(true);
  });

  it('editing a category needs CATEGORIA_SETOR_VISUALIZAR + CATEGORIA_SETOR_EDITAR', () => {
    store.setIdentity(identity(['CATEGORIA_SETOR_EDITAR']));
    expect(blocks(leaf(SECTOR_CATEGORIES_ROUTES, ':categoryGuid/editar'))).toBe(true);

    store.setIdentity(identity(['CATEGORIA_SETOR_VISUALIZAR']));
    expect(blocks(leaf(SECTOR_CATEGORIES_ROUTES, ':categoryGuid/editar'))).toBe(true);

    store.setIdentity(identity([...SECTOR_CATEGORY_SCREENS.edit]));
    expect(allows(leaf(SECTOR_CATEGORIES_ROUTES, ':categoryGuid/editar'))).toBe(true);
  });

  it('the category list needs only CATEGORIA_SETOR_VISUALIZAR', () => {
    store.setIdentity(identity(['CATEGORIA_SETOR_CRIAR']));
    expect(blocks(leaf(SECTOR_CATEGORIES_ROUTES, ''))).toBe(true);
    store.setIdentity(identity(['CATEGORIA_SETOR_VISUALIZAR']));
    expect(allows(leaf(SECTOR_CATEGORIES_ROUTES, ''))).toBe(true);
  });

  // ---- security invariants ---------------------------------------

  it('sends an anonymous user to /login from every sector/category leaf', () => {
    const router = TestBed.inject(Router);
    for (const route of [...SECTORS_ROUTES, ...SECTOR_CATEGORIES_ROUTES]) {
      const guard = (route.canMatch ?? [])[0] as CanMatchFn;
      const result = TestBed.runInInjectionContext(() => guard(route, [] as UrlSegment[]));
      expect(result instanceof UrlTree).toBe(true);
      expect(router.serializeUrl(result as UrlTree)).toBe('/login');
    }
  });
});
