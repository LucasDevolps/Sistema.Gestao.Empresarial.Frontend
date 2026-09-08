import { CurrentUserResponse } from '../models/auth.models';
import { AuthStore } from './auth-store';

function identity(permissions: string[]): CurrentUserResponse {
  return {
    userGuid: '11111111-1111-1111-1111-111111111111',
    email: 'user@hospital.test',
    active: true,
    permissionVersion: 3,
    employee: null,
    organization: null,
    hiringUnit: null,
    permissions,
  };
}

describe('AuthStore', () => {
  let store: AuthStore;

  beforeEach(() => {
    store = new AuthStore();
  });

  it('denies every permission while anonymous (deny by default)', () => {
    expect(store.isAuthenticated()).toBe(false);
    expect(store.hasPermission('FUNCIONARIO_VISUALIZAR')).toBe(false);
    expect(store.hasAll(['FUNCIONARIO_VISUALIZAR'])).toBe(false);
    expect(store.hasAny(['FUNCIONARIO_VISUALIZAR'])).toBe(false);
  });

  it('grants only the exact permission codes returned by /auth/me', () => {
    store.setIdentity(identity(['FUNCIONARIO_VISUALIZAR', 'SETOR_VISUALIZAR']));
    expect(store.isAuthenticated()).toBe(true);
    expect(store.hasPermission('FUNCIONARIO_VISUALIZAR')).toBe(true);
    expect(store.hasPermission('FUNCIONARIO_CRIAR')).toBe(false);
    expect(store.hasAll(['FUNCIONARIO_VISUALIZAR', 'SETOR_VISUALIZAR'])).toBe(true);
    expect(store.hasAll(['FUNCIONARIO_VISUALIZAR', 'USUARIO_GERENCIAR_PERMISSOES'])).toBe(false);
  });

  it('replaces the whole permission snapshot on re-identity', () => {
    store.setIdentity(identity(['FUNCIONARIO_VISUALIZAR']));
    store.setIdentity(identity(['SETOR_VISUALIZAR']));
    expect(store.hasPermission('FUNCIONARIO_VISUALIZAR')).toBe(false);
    expect(store.hasPermission('SETOR_VISUALIZAR')).toBe(true);
  });

  it('bumps the epoch on login and on reset so stale responses can be dropped', () => {
    const start = store.epoch();
    store.markLoggedIn();
    expect(store.epoch()).toBe(start + 1);
    store.reset('logout');
    expect(store.epoch()).toBe(start + 2);
    expect(store.isAuthenticated()).toBe(false);
    expect(store.sessionEndReason()).toBe('logout');
  });

  it('clears identity and permissions on reset', () => {
    store.setIdentity(identity(['FUNCIONARIO_VISUALIZAR']));
    store.reset('expired');
    expect(store.currentUser()).toBeNull();
    expect(store.hasPermission('FUNCIONARIO_VISUALIZAR')).toBe(false);
  });
});
