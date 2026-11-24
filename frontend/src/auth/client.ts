import type { components } from '../api/schema';
import { beginRequest } from '../api/pendingRequests';

export type AuthConfig = components['schemas']['PublicAuthConfig'];
export type Profile = components['schemas']['AccountProfile'];
export interface Session {
  accessToken: string;
  expiresAt: number;
  email: string;
  recovery: boolean;
}

export class AccountError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

type ErrorMessage = (response: Response) => Promise<string | undefined>;

export async function jsonRequest(
  url: string,
  init?: RequestInit,
  messageForError?: ErrorMessage,
): Promise<unknown> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  const timer = window.setTimeout(abort, 10_000);
  init?.signal?.addEventListener('abort', abort, { once: true });
  if (init?.signal?.aborted) controller.abort();
  const finish = beginRequest();
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: 'no-store',
      // Same-origin requests may need the host's Preview Protection cookie.
      // Application identity still requires our in-memory bearer token.
      credentials: url.startsWith('/') ? 'same-origin' : 'omit',
      redirect: 'error',
    });
    if (!response.ok) {
      const specificMessage = await messageForError?.(response);
      throw new AccountError(
        response.status,
        specificMessage ??
          (response.status === 429
            ? 'Too many attempts. Wait a little before trying again.'
            : 'The request could not be completed. Try again.'),
      );
    }
    if (response.status === 204) return null;
    return await response.json();
  } catch (error) {
    if (error instanceof AccountError) throw error;
    throw new AccountError(0, 'Check your connection and try again.');
  } finally {
    window.clearTimeout(timer);
    init?.signal?.removeEventListener('abort', abort);
    finish();
  }
}

async function passwordUpdateError(response: Response): Promise<string | undefined> {
  if (response.status !== 422) return;
  const body: unknown = await response.json().catch(() => null);
  if (
    body &&
    typeof body === 'object' &&
    'error_code' in body &&
    body.error_code === 'same_password'
  )
    return 'Choose a password different from your current one.';
}

async function providerErrorCode(response: Response): Promise<unknown> {
  const body: unknown = await response.json().catch(() => null);
  return body && typeof body === 'object' && 'error_code' in body ? body.error_code : undefined;
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AccountError(0, 'The service returned an unexpected response.');
  }
  return value as Record<string, unknown>;
}

export async function loadAuthConfig(signal: AbortSignal): Promise<AuthConfig> {
  const value = record(await jsonRequest('/api/auth/config', { signal }));
  if (
    typeof value.url !== 'string' ||
    typeof value.publishable_key !== 'string' ||
    typeof value.minimum_password_length !== 'number'
  )
    throw new AccountError(0, 'Account setup is unavailable.');
  return {
    url: value.url,
    publishable_key: value.publishable_key,
    minimum_password_length: value.minimum_password_length,
    signup_enabled: value.signup_enabled === true,
  };
}

export class AccountClient {
  constructor(private readonly config: AuthConfig) {}
  private provider(
    path: string,
    method: string,
    body?: unknown,
    {
      token,
      signal,
      messageForError,
    }: {
      token?: string;
      signal?: AbortSignal | undefined;
      messageForError?: ErrorMessage;
    } = {},
  ) {
    return jsonRequest(
      this.config.url + '/auth/v1' + path,
      {
        method,
        signal: signal ?? null,
        headers: {
          apikey: this.config.publishable_key,
          'Content-Type': 'application/json',
          ...(token ? { Authorization: 'Bearer ' + token } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      },
      messageForError,
    );
  }
  async signIn(email: string, password: string, signal?: AbortSignal): Promise<Session> {
    let value: Record<string, unknown>;
    try {
      value = record(
        await this.provider('/token?grant_type=password', 'POST', { email, password }, { signal }),
      );
    } catch (error) {
      if (error instanceof AccountError && [400, 401].includes(error.status)) {
        throw new AccountError(error.status, 'Check your email and password, then try again.');
      }
      throw error;
    }
    if (typeof value.access_token !== 'string' || typeof value.expires_in !== 'number') {
      throw new AccountError(0, 'Sign-in could not be verified. Try again.');
    }
    return {
      accessToken: value.access_token,
      expiresAt: Date.now() + value.expires_in * 1000,
      email,
      recovery: false,
    };
  }
  async signUp(email: string, password: string, signal: AbortSignal): Promise<void> {
    if (!this.config.signup_enabled) throw new AccountError(403, 'Registration is closed.');
    let duplicate = false;
    try {
      await this.provider(
        '/signup',
        'POST',
        { email, password },
        {
          signal,
          messageForError: async (response) => {
            const code = await providerErrorCode(response);
            duplicate = code === 'user_already_exists' || code === 'email_exists';
            if (code === 'weak_password') return 'Choose a stronger password and try again.';
            if (code === 'signup_disabled') return 'Registration is closed.';
            if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit')
              return 'Too many attempts. Wait a little before trying again.';
          },
        },
      );
    } catch (error) {
      if (!duplicate) throw error;
    }
    // Confirmation settings control whether the provider returns a session. Never use it here.
  }
  async confirmEmail(tokenHash: string): Promise<void> {
    const value = record(
      await this.provider(
        '/verify',
        'POST',
        { token_hash: tokenHash, type: 'email' },
        {
          messageForError: async (response) =>
            [400, 401, 403, 422].includes(response.status)
              ? 'This confirmation link is invalid, expired, or already used.'
              : undefined,
        },
      ),
    );
    if (typeof value.access_token !== 'string')
      throw new AccountError(0, 'Email confirmation could not be verified. Try signing in.');
    // End only the session created by confirmation. Existing signed-in devices are independent.
    await this.provider('/logout?scope=local', 'POST', undefined, {
      token: value.access_token,
    }).catch(() => undefined);
  }
  async recover(email: string): Promise<void> {
    const redirect = encodeURIComponent(window.location.origin + '/reset-password');
    await this.provider('/recover?redirect_to=' + redirect, 'POST', { email });
  }
  async resetPassword(session: Session, password: string): Promise<void> {
    await this.provider(
      '/user',
      'PUT',
      { password },
      {
        token: session.accessToken,
        messageForError: passwordUpdateError,
      },
    );
  }
  async signOut(session: Session): Promise<void> {
    await this.provider('/logout?scope=global', 'POST', undefined, { token: session.accessToken });
  }
  async profile(session: Session, timezone?: string, signal?: AbortSignal): Promise<Profile> {
    const value = record(
      await jsonRequest('/api/profile', {
        method: timezone === undefined ? 'GET' : 'PUT',
        signal: signal ?? null,
        headers: {
          Authorization: 'Bearer ' + session.accessToken,
          'Content-Type': 'application/json',
        },
        ...(timezone === undefined ? {} : { body: JSON.stringify({ timezone }) }),
      }),
    );
    if (typeof value.owner_id !== 'string' || typeof value.timezone !== 'string') {
      throw new AccountError(0, 'Your account could not be loaded. Try again.');
    }
    return value as unknown as Profile;
  }
}

export function recoveryFromLocation(): { session: Session | null; notice: string } {
  const values = new URLSearchParams(window.location.hash.slice(1));
  const query = new URLSearchParams(window.location.search);
  const queryRecovery =
    window.location.pathname === '/reset-password' &&
    ['code', 'token_hash', 'error', 'error_description'].some((key) => query.has(key));
  const hasRecovery = ['access_token', 'refresh_token', 'error', 'error_description'].some((key) =>
    values.has(key),
  );
  if (!hasRecovery && !queryRecovery) return { session: null, notice: '' };
  // Fragments are not sent to the HTTP server. Remove them before React or any request runs.
  window.history.replaceState(null, '', window.location.pathname);
  const token = values.get('access_token');
  const seconds = Number(values.get('expires_in'));
  if (
    window.location.pathname !== '/reset-password' ||
    values.get('type') !== 'recovery' ||
    !token ||
    !Number.isFinite(seconds) ||
    seconds <= 0 ||
    seconds > 86400 ||
    values.has('error')
  ) {
    return {
      session: null,
      notice: 'This reset link is invalid or has expired. Request a new link.',
    };
  }
  return {
    session: {
      accessToken: token,
      expiresAt: Date.now() + seconds * 1000,
      email: '',
      recovery: true,
    },
    notice: '',
  };
}

type Snapshot = { session: Session | null; notice: string };
const listeners = new Set<() => void>();
let snapshot: Snapshot = { session: null, notice: '' };
let expiryTimer: number | undefined;
function publish(next: Snapshot) {
  if (expiryTimer !== undefined) window.clearTimeout(expiryTimer);
  snapshot = next;
  if (next.session) {
    expiryTimer = window.setTimeout(
      () => sessionStore.clear('Your session expired. Sign in again.'),
      Math.max(0, Math.min(next.session.expiresAt - Date.now(), 2_147_483_647)),
    );
  }
  listeners.forEach((listener) => listener());
}
export const sessionStore = {
  getSnapshot: () => snapshot,
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  signIn: (session: Session) => publish({ session, notice: '' }),
  clear: (notice = '') => publish({ session: null, notice }),
};

export function initializeRecovery() {
  publish(recoveryFromLocation());
}

export function confirmationFromLocation() {
  if (window.location.pathname !== '/confirm-email') return null;
  const values = new URLSearchParams(window.location.hash.slice(1));
  const token = values.get('token_hash');
  window.history.replaceState(null, '', '/confirm-email');
  return token;
}
