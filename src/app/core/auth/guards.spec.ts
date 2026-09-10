import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { CurrentUserResponse } from '../models/auth.models';
import { AuthStore } from './auth-store';
import { authGuard, guestGuard, permissionGuard, permissionGuardAny } from './guards';

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

describe('route guards', () => {
  let store: AuthStore;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    store = TestBed.inject(AuthStore);
    router = TestBed.inject(Router);
  });

  function run<T>(fn: () => T): T {
    return TestBed.runInInjectionContext(fn);
  }

  it('authGuard redirects anonymous users to /login', () => {
    const result = run(() => authGuard({} as never, {} as never));
    expect(result instanceof UrlTree).toBe(true);
    expect(router.serializeUrl(result as UrlTree)).toBe('/login');
  });

  it('authGuard allows an authenticated user', () => {
    store.setIdentity(identity([]));
    expect(run(() => authGuard({} as never, {} as never))).toBe(true);
  });

  it('guestGuard bounces an authenticated user away from /login', () => {
    store.setIdentity(identity([]));
    const result = run(() => guestGuard({} as never, {} as never));
    expect(result instanceof UrlTree).toBe(true);
    expect(router.serializeUrl(result as UrlTree)).toBe('/');
  });

  it('permissionGuard denies by default when the code is missing', () => {
    store.setIdentity(identity(['FUNCIONARIO_VISUALIZAR']));
    const guard = permissionGuard('USUARIO_GERENCIAR_PERMISSOES');
    const result = run(() => guard({} as never, [] as never));
    expect(result instanceof UrlTree).toBe(true);
    expect(router.serializeUrl(result as UrlTree)).toBe('/');
  });

  it('permissionGuard allows when every required code is held', () => {
    store.setIdentity(identity(['PROFISSAO_VISUALIZAR', 'PROFISSAO_CRIAR']));
    const guard = permissionGuard('PROFISSAO_VISUALIZAR', 'PROFISSAO_CRIAR');
    expect(run(() => guard({} as never, [] as never))).toBe(true);
  });

  it('permissionGuard sends an anonymous user to /login', () => {
    const guard = permissionGuard('PROFISSAO_VISUALIZAR');
    const result = run(() => guard({} as never, [] as never));
    expect(router.serializeUrl(result as UrlTree)).toBe('/login');
  });

  it('permissionGuardAny passes with a single matching code (no extra requirement stacked)', () => {
    // A user who can only CREATE sectors must still reach the shared /setores path.
    store.setIdentity(identity(['SETOR_CRIAR']));
    const guard = permissionGuardAny('SETOR_VISUALIZAR', 'SETOR_CRIAR', 'SETOR_EDITAR');
    expect(run(() => guard({} as never, [] as never))).toBe(true);
  });

  it('permissionGuardAny denies when none of the codes are held', () => {
    store.setIdentity(identity(['FUNCIONARIO_VISUALIZAR']));
    const guard = permissionGuardAny('SETOR_VISUALIZAR', 'SETOR_CRIAR', 'SETOR_EDITAR');
    const result = run(() => guard({} as never, [] as never));
    expect(result instanceof UrlTree).toBe(true);
    expect(router.serializeUrl(result as UrlTree)).toBe('/');
  });

  it('permissionGuardAny sends an anonymous user to /login', () => {
    const guard = permissionGuardAny('SETOR_VISUALIZAR', 'SETOR_CRIAR');
    const result = run(() => guard({} as never, [] as never));
    expect(router.serializeUrl(result as UrlTree)).toBe('/login');
  });
});
