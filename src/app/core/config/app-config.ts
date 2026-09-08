import { InjectionToken, inject } from '@angular/core';

/**
 * Runtime configuration for the frontend.
 *
 * Loaded once at bootstrap from `/config.json` so the API location can change per
 * environment without rebuilding the bundle. This file MUST NOT carry secrets:
 * everything shipped to the browser is publicly inspectable (spec sections 5, 20).
 */
export interface AppConfig {
  /**
   * Base URL for every backend call. Defaults to the same-origin relative path
   * `/api`, which keeps the browser inside the Nginx perimeter and avoids CORS
   * Local publishing keeps this path; public publishing supplies an HTTPS API
   * origin ending in /api and an explicit backend CORS allowlist.
   */
  readonly apiBaseUrl: string;

  /** How many seconds before access-token expiry the UI shows the expiry warning. */
  readonly sessionExpiryWarningSeconds: number;
}

export const DEFAULT_APP_CONFIG: AppConfig = {
  apiBaseUrl: '/api',
  sessionExpiryWarningSeconds: 120,
};

export const APP_CONFIG = new InjectionToken<AppConfig>('APP_CONFIG', {
  providedIn: 'root',
  factory: () => DEFAULT_APP_CONFIG,
});

/** Mutable holder filled by {@link loadAppConfig} before the app renders. */
const runtimeConfig: { value: AppConfig } = { value: DEFAULT_APP_CONFIG };

export async function loadAppConfig(): Promise<void> {
  let parsed: unknown;
  try {
    const response = await fetch('config.json', { cache: 'no-cache' });
    if (!response.ok) {
      return;
    }
    parsed = await response.json();
  } catch {
    // Keep defaults; a missing/broken config.json must not block the shell.
    return;
  }
  // An explicitly unsafe API URL must never silently receive login credentials.
  runtimeConfig.value = resolveAppConfig(parsed, window.location.href);
}

export function resolveAppConfig(value: unknown, pageUrl: string): AppConfig {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Configuração pública da aplicação inválida.');
  }
  const parsed = value as Partial<AppConfig> & { localApiBaseUrl?: string };
  const page = new URL(pageUrl);
  const configured = isLoopbackHost(page.hostname) && parsed.localApiBaseUrl !== undefined
    ? parsed.localApiBaseUrl
    : (parsed.apiBaseUrl ?? DEFAULT_APP_CONFIG.apiBaseUrl);

  return {
    apiBaseUrl: normalizeApiBaseUrl(configured, page),
    sessionExpiryWarningSeconds:
      typeof parsed.sessionExpiryWarningSeconds === 'number' &&
      Number.isFinite(parsed.sessionExpiryWarningSeconds) && parsed.sessionExpiryWarningSeconds > 0
        ? parsed.sessionExpiryWarningSeconds
        : DEFAULT_APP_CONFIG.sessionExpiryWarningSeconds,
  };
}

function normalizeApiBaseUrl(value: string, page: URL): string {
  const invalid = () => new Error('A URL da API deve usar HTTPS e terminar em /api; HTTP somente em loopback local.');
  if (typeof value !== 'string' || /[\s\\]/.test(value)) throw invalid();
  const normalized = value.replace(/\/+$/, '');
  if (/^\/(?!\/)[a-zA-Z0-9/_-]*api$/.test(normalized) && normalized.endsWith('/api')) {
    return normalized;
  }
  let url: URL;
  try {
    url = new URL(normalized);
  } catch {
    throw invalid();
  }
  const localHttp = page.protocol === 'http:' && isLoopbackHost(page.hostname)
    && url.protocol === 'http:' && isLoopbackHost(url.hostname);
  if ((url.protocol !== 'https:' && !localHttp) || url.username || url.password
      || url.search || url.hash || !url.pathname.endsWith('/api')
      || (!isLoopbackHost(page.hostname) && isLoopbackHost(url.hostname))) {
    throw invalid();
  }
  return `${url.origin}${url.pathname}`;
}

function isLoopbackHost(host: string): boolean {
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
}

/** Compare parsed origins and path boundaries, never raw string prefixes. */
export function isApiRequestUrl(requestUrl: string, apiBaseUrl: string, pageUrl: string): boolean {
  try {
    const api = new URL(apiBaseUrl, pageUrl);
    const request = new URL(requestUrl, pageUrl);
    const basePath = api.pathname.replace(/\/+$/, '');
    return !request.username && !request.password && request.origin === api.origin
      && (request.pathname === basePath || request.pathname.startsWith(`${basePath}/`));
  } catch {
    return false;
  }
}

export function provideRuntimeAppConfig() {
  return {
    provide: APP_CONFIG,
    useFactory: (): AppConfig => runtimeConfig.value,
  };
}

/** Convenience accessor for use inside injection contexts. */
export function apiUrl(path: string): string {
  const config = inject(APP_CONFIG);
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${config.apiBaseUrl}${normalized}`;
}
