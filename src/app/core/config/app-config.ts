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
   * (the backend registers no CORS policy — spec sections 5, 19).
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
  try {
    const response = await fetch('config.json', { cache: 'no-cache' });
    if (!response.ok) {
      return;
    }
    const parsed = (await response.json()) as Partial<AppConfig>;
    runtimeConfig.value = {
      apiBaseUrl:
        typeof parsed.apiBaseUrl === 'string' && parsed.apiBaseUrl.trim().length > 0
          ? parsed.apiBaseUrl.replace(/\/+$/, '')
          : DEFAULT_APP_CONFIG.apiBaseUrl,
      sessionExpiryWarningSeconds:
        typeof parsed.sessionExpiryWarningSeconds === 'number' &&
        parsed.sessionExpiryWarningSeconds > 0
          ? parsed.sessionExpiryWarningSeconds
          : DEFAULT_APP_CONFIG.sessionExpiryWarningSeconds,
    };
  } catch {
    // Keep defaults; a missing/broken config.json must not block the shell.
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
