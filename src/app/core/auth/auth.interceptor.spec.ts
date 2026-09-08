import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideRuntimeAppConfig } from '../config/app-config';
import { NotificationService } from '../notifications/notification.service';
import { authInterceptor } from './auth.interceptor';
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

const meResponse = {
  userGuid: authResponse.userGuid,
  email: 'user@hospital.test',
  active: true,
  permissionVersion: 1,
  employee: null,
  organization: null,
  hiringUnit: null,
  permissions: ['FUNCIONARIO_VISUALIZAR'],
};

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let tokens: TokenStore;
  let store: AuthStore;
  let auth: AuthService;
  let notifications: NotificationService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRuntimeAppConfig(),
        { provide: Router, useValue: { navigate: jasmine.createSpy('navigate').and.resolveTo(true) } },
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    tokens = TestBed.inject(TokenStore);
    store = TestBed.inject(AuthStore);
    auth = TestBed.inject(AuthService);
    notifications = TestBed.inject(NotificationService);
    tokens.set(authResponse);
    store.setIdentity(meResponse);
  });

  afterEach(() => httpMock.verify());

  it('adds the bearer header to API requests but not to /auth/login', () => {
    http.get('/api/funcionarios').subscribe();
    const apiReq = httpMock.expectOne('/api/funcionarios');
    expect(apiReq.request.headers.get('Authorization')).toBe('Bearer access-1');
    apiReq.flush({ items: [], page: 1, pageSize: 50, total: 0 });

    http.post('/api/auth/login', {}).subscribe();
    const loginReq = httpMock.expectOne('/api/auth/login');
    expect(loginReq.request.headers.has('Authorization')).toBe(false);
    loginReq.flush(authResponse);
  });

  it('refreshes once and replays a GET exactly one time on 401', () => {
    let payload: unknown;
    http.get('/api/funcionarios').subscribe((r) => (payload = r));

    httpMock.expectOne('/api/funcionarios').flush('no', { status: 401, statusText: 'Unauthorized' });

    const refreshReq = httpMock.expectOne('/api/auth/refresh');
    refreshReq.flush({ ...authResponse, accessToken: 'access-2', refreshToken: 'refresh-2' });
    httpMock.expectOne('/api/auth/me').flush(meResponse);

    const replay = httpMock.expectOne('/api/funcionarios');
    expect(replay.request.headers.get('Authorization')).toBe('Bearer access-2');
    replay.flush({ items: [], page: 1, pageSize: 50, total: 3 });

    expect(payload).toEqual({ items: [], page: 1, pageSize: 50, total: 3 });
  });

  it('does not replay a POST after a 401 refresh', () => {
    const errorSpy = jasmine.createSpy('error');
    http.post('/api/funcionarios', { name: 'x' }).subscribe({ error: errorSpy });

    httpMock.expectOne('/api/funcionarios').flush('no', { status: 401, statusText: 'Unauthorized' });
    httpMock.expectOne('/api/auth/refresh').flush({ ...authResponse, accessToken: 'access-2' });
    httpMock.expectOne('/api/auth/me').flush(meResponse);

    httpMock.expectNone('/api/funcionarios');
    expect(errorSpy).toHaveBeenCalled();
  });

  it('routes a single refresh for many simultaneous 401s', () => {
    http.get('/api/funcionarios').subscribe({ error: () => undefined });
    http.get('/api/cargos').subscribe({ error: () => undefined });
    http.get('/api/setores').subscribe({ error: () => undefined });

    httpMock.expectOne('/api/funcionarios').flush('no', { status: 401, statusText: 'Unauthorized' });
    httpMock.expectOne('/api/cargos').flush('no', { status: 401, statusText: 'Unauthorized' });
    httpMock.expectOne('/api/setores').flush('no', { status: 401, statusText: 'Unauthorized' });

    expect(httpMock.match('/api/auth/refresh').length).toBe(1);
  });

  it('invokes handleForbidden on a 403 and propagates the error', () => {
    const spy = spyOn(auth, 'handleForbidden');
    const errorSpy = jasmine.createSpy('error');
    http.get('/api/usuarios').subscribe({ error: errorSpy });
    httpMock.expectOne('/api/usuarios').flush('no', { status: 403, statusText: 'Forbidden' });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalled();
  });

  it('warns on 429 and never retries', () => {
    const warnSpy = spyOn(notifications, 'warning');
    const errorSpy = jasmine.createSpy('error');
    http.get('/api/funcionarios').subscribe({ error: errorSpy });
    httpMock
      .expectOne('/api/funcionarios')
      .flush('slow down', { status: 429, statusText: 'Too Many Requests' });
    expect(warnSpy).toHaveBeenCalled();
    httpMock.expectNone('/api/auth/refresh');
    expect(errorSpy).toHaveBeenCalled();
  });
});
