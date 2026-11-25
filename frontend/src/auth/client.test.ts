import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccountClient, AccountError, recoveryFromLocation, sessionStore } from './client';

afterEach(() => {
  sessionStore.clear();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

describe('memory-only account sessions', () => {
  it('discards refresh tokens and never writes either browser storage', async () => {
    const storage = vi.spyOn(Storage.prototype, 'setItem');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            access_token: 'synthetic-access',
            refresh_token: 'must-not-retain',
            expires_in: 3600,
          }),
          { status: 200 },
        ),
      ),
    );
    const session = await new AccountClient({
      url: 'https://auth.example',
      publishable_key: 'sb_publishable_test',
      minimum_password_length: 12,
      signup_enabled: false,
    }).signIn('synthetic@example.test', 'SyntheticPassword123');
    sessionStore.signIn(session);
    expect(JSON.stringify(sessionStore.getSnapshot())).not.toContain('must-not-retain');
    expect(storage).not.toHaveBeenCalled();
    sessionStore.clear();
    expect(sessionStore.getSnapshot().session).toBeNull();
    storage.mockRestore();
  });
  it('clears expired sessions without refreshing them', () => {
    vi.useFakeTimers();
    sessionStore.signIn({
      accessToken: 'synthetic',
      expiresAt: Date.now() + 1000,
      email: 'synthetic@example.test',
      recovery: false,
    });
    const cache = sessionStore.getSnapshot().cache!;
    cache.setQueryData(['people'], [{ name: 'Synthetic person' }]);
    vi.advanceTimersByTime(1001);
    expect(sessionStore.getSnapshot().session).toBeNull();
    expect(cache.getQueryCache().getAll()).toEqual([]);
    expect(sessionStore.getSnapshot().notice).toContain('expired');
  });
  it('strips recovery credentials from history and retains no refresh token', () => {
    window.history.replaceState(
      null,
      '',
      '/reset-password#access_token=synthetic&refresh_token=must-not-retain&type=recovery&expires_in=3600',
    );
    const recovered = recoveryFromLocation();
    expect(window.location.hash).toBe('');
    expect(recovered.session?.recovery).toBe(true);
    expect(JSON.stringify(recovered)).not.toContain('must-not-retain');
  });
  it('rejects incomplete/error links and removes their parameters', () => {
    window.history.replaceState(
      null,
      '',
      '/reset-password?error=invalid&error_description=synthetic-sensitive',
    );
    expect(recoveryFromLocation().session).toBeNull();
    expect(window.location.search).toBe('');
    expect(window.location.hash).toBe('');
  });
  it('never echoes provider response bodies in user errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(new Response('synthetic-sensitive-provider-message', { status: 400 })),
    );
    const client = new AccountClient({
      url: 'https://auth.example',
      publishable_key: 'sb_publishable_test',
      minimum_password_length: 12,
      signup_enabled: false,
    });
    await expect(
      client.signIn('synthetic@example.test', 'SyntheticPassword123'),
    ).rejects.toMatchObject({
      message: 'Check your email and password, then try again.',
    } satisfies Partial<AccountError>);
  });
});
