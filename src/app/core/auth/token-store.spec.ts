import { AuthenticationResponse } from '../models/auth.models';
import { TokenStore } from './token-store';

const response: AuthenticationResponse = {
  accessToken: 'access-1',
  refreshToken: 'refresh-1',
  tokenType: 'Bearer',
  expiresIn: 600,
  sessionId: '22222222-2222-2222-2222-222222222222',
  userGuid: '11111111-1111-1111-1111-111111111111',
};

describe('TokenStore', () => {
  let store: TokenStore;

  beforeEach(() => {
    store = new TokenStore();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('starts empty', () => {
    expect(store.hasTokens()).toBe(false);
    expect(store.accessToken).toBeNull();
    expect(store.refreshPayload()).toBeNull();
  });

  it('stores the token triple in memory only, never in web storage', () => {
    store.set(response);
    expect(store.accessToken).toBe('access-1');
    expect(store.sessionId).toBe(response.sessionId);
    expect(store.refreshPayload()).toEqual({
      sessionId: response.sessionId,
      refreshToken: 'refresh-1',
    });
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    expect(JSON.stringify(localStorage)).not.toContain('refresh-1');
  });

  it('atomically replaces every value on rotation', () => {
    store.set(response);
    store.set({ ...response, accessToken: 'access-2', refreshToken: 'refresh-2' });
    expect(store.accessToken).toBe('access-2');
    expect(store.refreshPayload()?.refreshToken).toBe('refresh-2');
  });

  it('clears all values', () => {
    store.set(response);
    store.clear();
    expect(store.hasTokens()).toBe(false);
    expect(store.accessToken).toBeNull();
  });
});
