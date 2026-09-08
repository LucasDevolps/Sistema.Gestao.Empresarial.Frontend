import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { CurrentUserResponse } from '../models/auth.models';
import { provideRuntimeAppConfig } from '../config/app-config';
import { AuthService } from './auth.service';
import { AuthStore } from './auth-store';
import { TokenStore } from './token-store';

const authResponse = {
  accessToken: 'access-1',
  refreshToken: 'refresh-1',
  tokenType: 'Bearer',
  expiresIn: 600,
  sessionId: '22222222-2222-2222-2222-222222222222',
  userGuid: '11111111-1111-1111-1111-111111111111',
};

const meResponse: CurrentUserResponse = {
  userGuid: authResponse.userGuid,
  email: 'user@hospital.test',
  active: true,
  permissionVersion: 1,
  employee: null,
  organization: null,
  hiringUnit: null,
  permissions: ['FUNCIONARIO_VISUALIZAR'],
};

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let store: AuthStore;
  let tokens: TokenStore;
  let navigate: jasmine.Spy;

  beforeEach(() => {
    navigate = jasmine.createSpy('navigate').and.resolveTo(true);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRuntimeAppConfig(),
        { provide: Router, useValue: { navigate } },
      ],
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
    store = TestBed.inject(AuthStore);
    tokens = TestBed.inject(TokenStore);
  });

  afterEach(() => httpMock.verify());

  it('only marks the session authenticated after /auth/me succeeds', () => {
    let emitted: CurrentUserResponse | undefined;
    service.login({ email: 'user@hospital.test', password: 'secret' }).subscribe((u) => (emitted = u));

    const loginReq = httpMock.expectOne('/api/auth/login');
    expect(loginReq.request.method).toBe('POST');
    loginReq.flush(authResponse);

    // Authenticated flag must NOT be set yet.
    expect(store.isAuthenticated()).toBe(false);

    const meReq = httpMock.expectOne('/api/auth/me');
    meReq.flush(meResponse);

    expect(emitted).toEqual(meResponse);
    expect(store.isAuthenticated()).toBe(true);
    expect(store.hasPermission('FUNCIONARIO_VISUALIZAR')).toBe(true);
    expect(tokens.accessToken).toBe('access-1');
  });

  it('drops tokens and stays anonymous when /auth/me fails right after login', () => {
    const errorSpy = jasmine.createSpy('error');
    service.login({ email: 'user@hospital.test', password: 'secret' }).subscribe({ error: errorSpy });

    httpMock.expectOne('/api/auth/login').flush(authResponse);
    httpMock.expectOne('/api/auth/me').flush('boom', { status: 500, statusText: 'Server Error' });

    expect(errorSpy).toHaveBeenCalled();
    expect(store.isAuthenticated()).toBe(false);
    expect(tokens.hasTokens()).toBe(false);
  });

  it('coalesces concurrent refresh calls into a single /auth/refresh request', () => {
    tokens.set(authResponse);

    const results: boolean[] = [];
    service.refresh().subscribe((ok) => results.push(ok));
    service.refresh().subscribe((ok) => results.push(ok));
    service.refresh().subscribe((ok) => results.push(ok));

    const refreshReqs = httpMock.match('/api/auth/refresh');
    expect(refreshReqs.length).toBe(1);
    refreshReqs[0].flush({ ...authResponse, accessToken: 'access-2', refreshToken: 'refresh-2' });

    httpMock.expectOne('/api/auth/me').flush(meResponse);

    expect(results).toEqual([true, true, true]);
    expect(tokens.accessToken).toBe('access-2');
  });

  it('ends the session when refresh is rejected', () => {
    tokens.set(authResponse);

    let ok: boolean | undefined;
    service.refresh().subscribe((v) => (ok = v));
    httpMock
      .expectOne('/api/auth/refresh')
      .flush('nope', { status: 401, statusText: 'Unauthorized' });

    expect(ok).toBe(false);
    expect(tokens.hasTokens()).toBe(false);
    expect(store.sessionEndReason()).toBe('refresh-failed');
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });

  it('logout calls the backend and tears down local state immediately', () => {
    tokens.set(authResponse);
    store.setIdentity(meResponse);

    service.logout();

    // Local teardown happens synchronously, before the network resolves.
    expect(tokens.hasTokens()).toBe(false);
    expect(store.isAuthenticated()).toBe(false);

    const logoutReq = httpMock.expectOne('/api/auth/logout');
    expect(logoutReq.request.method).toBe('POST');
    logoutReq.flush(null, { status: 204, statusText: 'No Content' });
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });

  it('handleForbidden revalidates identity at most once', () => {
    tokens.set(authResponse);
    store.setIdentity(meResponse);

    service.handleForbidden();
    service.handleForbidden();

    const meReqs = httpMock.match('/api/auth/me');
    expect(meReqs.length).toBe(1);
    meReqs[0].flush({ ...meResponse, permissions: [] });
    expect(store.hasPermission('FUNCIONARIO_VISUALIZAR')).toBe(false);
  });
});
