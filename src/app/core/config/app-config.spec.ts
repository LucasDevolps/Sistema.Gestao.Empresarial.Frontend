import { isApiRequestUrl, resolveAppConfig } from './app-config';

describe('runtime API configuration', () => {
  const page = 'https://frontend.example.test/login';
  const api = 'https://backend.example.test/api';

  it('uses the configured public API, including the API path', () => {
    expect(resolveAppConfig({ apiBaseUrl: `${api}/` }, page).apiBaseUrl).toBe(api);
  });

  it('preserves local IIS through an explicitly configured local override', () => {
    const config = { apiBaseUrl: api, localApiBaseUrl: '/api' };
    for (const host of ['localhost', '127.0.0.1', '[::1]']) {
      expect(resolveAppConfig(config, `http://${host}:9080/login`).apiBaseUrl).toBe('/api');
    }
    expect(resolveAppConfig(config, page).apiBaseUrl).toBe(api);
    expect(resolveAppConfig({ apiBaseUrl: '/api' }, page).apiBaseUrl).toBe('/api');
  });

  it('allows HTTP only between local loopback origins', () => {
    const config = { apiBaseUrl: 'http://localhost:9081/api' };
    expect(resolveAppConfig(config, 'http://localhost:9080/login').apiBaseUrl).toBe(config.apiBaseUrl);
    expect(() => resolveAppConfig(config, page)).toThrow();
    expect(() => resolveAppConfig(config, 'https://localhost/login')).toThrow();
  });

  it('rejects unsafe URLs before any authentication call', () => {
    for (const apiBaseUrl of ['//backend.example.test/api', 'http://backend.example.test/api',
      'https://user:password@backend.example.test/api', `${api}?token=value`, `${api}#fragment`,
      'https://localhost/api', 'https://backend.example.test', 'javascript:alert(1)',
      'https://backend.example.test\\other/api']) {
      expect(() => resolveAppConfig({ apiBaseUrl }, page)).withContext(apiBaseUrl).toThrow();
    }
  });

  it('limits the Bearer destination to the exact API origin and path', () => {
    expect(isApiRequestUrl(`${api}/auth/me`, api, page)).toBeTrue();
    expect(isApiRequestUrl('/api/auth/me', '/api', page)).toBeTrue();
    for (const request of ['/config.json', '/api/auth/me', '//other.example.test/api/auth/me',
      'https://backend.example.test.other.example.test/api/auth/me', `${api}-other/auth/me`,
      `${api}/../admin`, 'https://backend.example.test:444/api/auth/me']) {
      expect(isApiRequestUrl(request, api, page)).withContext(request).toBeFalse();
    }
  });
});
