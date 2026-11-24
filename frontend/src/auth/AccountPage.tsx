import { PeoplePage } from '../people/PeoplePage';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from 'react';
import { Eye, EyeOff, Menu } from 'lucide-react';
import { Link } from '../navigation';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { Notice } from '../ui/Notice';
import { Loading } from '../ui/Loading';
import { Toast } from '../ui/Toast';
import { TimezoneField } from './TimezoneField';
import { AppearanceField, type Appearance } from '../ui/Appearance';
import { NotificationSettings } from '../push/NotificationSettings';
import { PrivacySettings } from '../privacy/PrivacySettings';
import { disableDevice, supportsPush } from '../push/client';
import {
  AccountClient,
  AccountError,
  loadAuthConfig,
  sessionStore,
  type AuthConfig,
  type Profile,
  type Session,
} from './client';

function errorMessage(error: unknown) {
  return error instanceof AccountError ? error.message : 'Something went wrong. Try again.';
}

const passwordRules =
  'Use at least 12 characters, including a lowercase letter, an uppercase letter, and a number.';
function passwordMeetsRules(password: string) {
  return /[a-z]/.test(password) && /[A-Z]/.test(password) && /[0-9]/.test(password);
}

function CredentialsForm({
  client,
  signup = false,
  signupEnabled = false,
  loading = false,
}: {
  client: AccountClient | null;
  signup?: boolean;
  signupEnabled?: boolean;
  loading?: boolean;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!client || request.current) return;
    if (signup && !passwordMeetsRules(password)) {
      setError(passwordRules);
      return;
    }
    setBusy(true);
    setError('');
    const abort = new AbortController();
    request.current = abort;
    try {
      if (signup) {
        await client.signUp(email.trim(), password, abort.signal);
        if (abort.signal.aborted) return;
        setPassword('');
        setSent(true);
        return;
      }
      const session = await client.signIn(email, password, abort.signal);
      if (abort.signal.aborted) return;
      await client.profile(session, undefined, abort.signal);
      if (abort.signal.aborted) return;
      setPassword('');
      sessionStore.signIn(session);
    } catch (failure) {
      if (!abort.signal.aborted) setError(errorMessage(failure));
    } finally {
      request.current = null;
      if (!abort.signal.aborted) setBusy(false);
    }
  }
  return (
    <section className="login stack">
      {signup ? (
        <h1>Create your account.</h1>
      ) : (
        <div className="stack stack--small">
          <p className="eyebrow">A private space for your people</p>
          <h1>Keep your people close.</h1>
          <p className="secondary">Remember when you last met. Make room for next time.</p>
        </div>
      )}
      {!client && !loading && (
        <Notice title="Account access is unavailable.">
          <p>Check the connection or try again later. You can still explore the sample.</p>
        </Notice>
      )}
      {sent ? (
        <Notice title="Check your email.">
          <p role="status">
            If this address can be registered, a confirmation link is on its way. Check spam if it
            doesn’t arrive. If you already have an account, sign in or reset your password.
          </p>
          <Button onClick={() => setSent(false)}>Try again with an email address</Button>
        </Notice>
      ) : (
        <form
          className="stack"
          onSubmit={(event) => {
            void submit(event);
          }}
        >
          <label htmlFor="email">
            Email
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
              disabled={busy}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label htmlFor="password">
            Password
            <input
              id="password"
              name="password"
              type={visible ? 'text' : 'password'}
              autoComplete={signup ? 'new-password' : 'current-password'}
              required
              disabled={busy}
              minLength={signup ? 12 : undefined}
              maxLength={signup ? 128 : undefined}
              aria-describedby={signup ? 'signup-password-rules' : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {signup && (
            <p id="signup-password-rules" className="supporting secondary">
              {passwordRules}
            </p>
          )}
          <Button
            variant="quiet"
            className="self-start"
            aria-controls="password"
            aria-pressed={visible}
            disabled={busy}
            onClick={() => setVisible(!visible)}
          >
            {visible ? (
              <EyeOff aria-hidden="true" size={18} />
            ) : (
              <Eye aria-hidden="true" size={18} />
            )}
            {visible ? 'Hide password' : 'Show password'}
          </Button>
          {error && (
            <p role="alert" className="error-text">
              {error}
            </p>
          )}
          <Button type="submit" variant="primary" disabled={!client} busy={busy}>
            {signup ? 'Create account' : 'Sign in'}
          </Button>
          {!signup && (
            <p className="supporting secondary">
              {!signupEnabled && 'Registration is closed. '}
              Reloading this page requires signing in again.
            </p>
          )}
        </form>
      )}
      {signup && (
        <Link className="text-link" href="/">
          Back to sign in
        </Link>
      )}
      {!signup && signupEnabled && (
        <Link className="text-link" href="/create-account">
          Create account
        </Link>
      )}
      <Link className="text-link" href="/forgot-password">
        Forgot password?
      </Link>
      {!signup && (
        <Link className="text-link" href="/design">
          Explore the sample
        </Link>
      )}
    </section>
  );
}

function ConfirmEmail({
  client,
  token,
  discardToken,
}: {
  client: AccountClient | null;
  token: string | null;
  discardToken: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  async function confirm() {
    if (!client || !token || busy) return;
    setBusy(true);
    setError('');
    try {
      await client.confirmEmail(token);
      setConfirmed(true);
      discardToken();
    } catch (failure) {
      setError(errorMessage(failure));
      if (failure instanceof AccountError && [400, 401, 403, 422].includes(failure.status)) {
        discardToken();
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="login stack">
      <h1>Confirm your email.</h1>
      {confirmed ? (
        <p role="status">Email confirmed. Sign in to open your library.</p>
      ) : token ? (
        <Button variant="primary" disabled={!client} busy={busy} onClick={() => void confirm()}>
          Confirm email
        </Button>
      ) : !error ? (
        <p>This confirmation link is missing, invalid, expired, or already used.</p>
      ) : null}
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      {!confirmed && !token && (
        <Link className="text-link" href="/create-account">
          Request a new confirmation link
        </Link>
      )}
      <Link className="text-link" href="/">
        Back to sign in
      </Link>
    </section>
  );
}

function RecoveryRequest({ client }: { client: AccountClient | null }) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!client || busy) return;
    setBusy(true);
    setError('');
    try {
      await client.recover(email);
      setSent(true);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="login stack">
      <h1>A fresh start.</h1>
      <p>Enter your account email to request a password-reset link.</p>
      {sent && (
        <Notice title="Check your email.">
          <p role="status">
            If this address belongs to an account, a reset link is on its way. Check spam, confirm
            the address, and allow a little time before requesting another link.
          </p>
        </Notice>
      )}
      <form
        className="stack"
        onSubmit={(event) => {
          void submit(event);
        }}
      >
        <label htmlFor="recovery-email">
          Email
          <input
            id="recovery-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" variant="primary" disabled={!client} busy={busy}>
          {sent ? 'Request another link' : 'Send reset link'}
        </Button>
      </form>
      <Link className="text-link" href="/">
        Back to sign in
      </Link>
    </section>
  );
}

function ResetPassword({ client, session }: { client: AccountClient; session: Session }) {
  const [verified, setVerified] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const abort = new AbortController();
    void client.profile(session, undefined, abort.signal).then(
      () => {
        if (!abort.signal.aborted) setVerified(true);
      },
      () => {
        if (!abort.signal.aborted)
          sessionStore.clear('This reset link could not be verified. Request a fresh link.');
      },
    );
    return () => abort.abort();
  }, [client, session]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !verified) return;
    if (password !== confirm) {
      setError('The passwords do not match.');
      return;
    }
    if (!passwordMeetsRules(password)) {
      setError('Include a lowercase letter, an uppercase letter, and a number.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await client.resetPassword(session, password);
      setPassword('');
      setConfirm('');
      let message = 'Password updated. Sign in with your new password.';
      try {
        await client.signOut(session);
      } catch {
        message = 'Password updated. Sign in again. Server sign-out could not be confirmed.';
      }
      const current = sessionStore.getSnapshot().session;
      if (current && current.accessToken !== session.accessToken) return;
      sessionStore.clear(message);
      window.history.replaceState(null, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="login stack">
      <h1>Choose a new password.</h1>
      <p id="password-rules">{passwordRules}</p>
      {!verified && <Loading label="Verifying your reset link" />}
      <form
        className="stack"
        onSubmit={(event) => {
          void submit(event);
        }}
      >
        <label htmlFor="new-password">
          New password
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={128}
            aria-describedby="password-rules"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <label htmlFor="confirm-password">
          Confirm password
          <input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={128}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </label>
        {error && (
          <p role="alert" className="error-text">
            {error}
          </p>
        )}
        <Button type="submit" variant="primary" disabled={!verified} busy={busy}>
          Update password
        </Button>
      </form>
      <Link className="text-link" href="/forgot-password">
        Request a fresh link
      </Link>
    </section>
  );
}

function PrivateAccount({
  client,
  session,
  appearance,
  setAppearance,
}: {
  client: AccountClient;
  session: Session;
  appearance: Appearance;
  setAppearance: (value: Appearance) => void;
}) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [timezone, setTimezone] = useState('UTC');
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
  const toastSequence = useRef(0);
  const dismissToast = useCallback(() => setToast(null), []);
  const [busy, setBusy] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [optOutOnLogout, setOptOutOnLogout] = useState(true);
  const [pushBusy, setPushBusy] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);
  function notify(message: string) {
    if (sessionStore.getSnapshot().session === session) {
      setToast({ id: ++toastSequence.current, message });
    }
  }
  useEffect(() => {
    const abort = new AbortController();
    void client.profile(session, undefined, abort.signal).then(
      (value) => {
        if (!abort.signal.aborted) {
          setProfile(value);
          setTimezone(value.timezone);
          setError('');
        }
      },
      (failure) => {
        if (abort.signal.aborted) return;
        if (failure instanceof AccountError && failure.status === 401)
          sessionStore.clear('Your session ended. Sign in again.');
        else setError('Your account could not be loaded. Check your connection and try again.');
      },
    );
    return () => abort.abort();
  }, [client, session, attempt]);
  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setSaveError('');
    try {
      const value = await client.profile(session, timezone);
      setProfile(value);
      notify('Timezone saved.');
    } catch (failure) {
      if (failure instanceof AccountError && failure.status === 401)
        sessionStore.clear('Your session ended. Sign in again.');
      else
        setSaveError(
          failure instanceof AccountError && failure.status === 422
            ? 'This timezone could not be saved. Choose another timezone and try again.'
            : errorMessage(failure),
        );
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    if (logoutBusy || pushBusy) return;
    setLogoutBusy(true);
    setLogoutError('');
    if (optOutOnLogout) {
      try {
        await disableDevice(session);
      } catch {
        setLogoutError(
          'Notifications could not be turned off. Reconnect and try again, or clear the checkbox to sign out and keep them on.',
        );
        setLogoutBusy(false);
        return;
      }
    }
    if (sessionStore.getSnapshot().session !== session) return;
    // Unmounting this keyed account view discards its profile, drafts, and in-flight reads.
    sessionStore.clear('Signed out.');
    void client.signOut(session).catch(() => {
      if (!sessionStore.getSnapshot().session)
        sessionStore.clear(
          'Signed out on this device. Server sign-out could not be confirmed; reconnect and sign in to try again.',
        );
    });
  }
  function closeMenu() {
    setMenuOpen(false);
    setConfirmLogout(false);
    setLogoutError('');
  }
  const accountError = error && (
    <Notice title="Please try again." variant="error">
      <p role="alert">{error}</p>
      <Button
        onClick={() => {
          setProfile(null);
          setAttempt((value) => value + 1);
        }}
      >
        Try again
      </Button>
    </Notice>
  );
  const feedback = toast && <Toast key={toast.id} message={toast.message} dismiss={dismissToast} />;
  return (
    <section className="private-account stack stack--large">
      <div className="account-heading">
        <h1>Your private space.</h1>
        <Button
          onClick={() => setMenuOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={menuOpen}
          aria-controls="account-menu"
        >
          <Menu aria-hidden="true" size={20} /> Menu
        </Button>
      </div>
      {profile && (
        <PeoplePage
          key={dataVersion}
          session={session}
          timezone={profile.timezone}
          notify={notify}
        />
      )}
      {!profile && !error && !menuOpen && <Loading label="Loading your account" />}
      {!menuOpen && accountError}
      {!menuOpen && feedback}
      {menuOpen && (
        <Dialog
          open
          id="account-menu"
          title="Settings and account"
          className="account-drawer"
          initialFocus="close"
          closeOnBackdrop
          onRequestClose={closeMenu}
          overlay={feedback}
        >
          <div className="stack stack--large">
            {accountError}
            {!profile && !error && <Loading label="Loading your preferences" />}
            {profile && (
              <form
                className="surface stack"
                onSubmit={(event) => {
                  void save(event);
                }}
              >
                <h2>Your preferences</h2>
                <TimezoneField value={timezone} onChange={setTimezone} disabled={busy} />
                {saveError && (
                  <p className="error-text" role="alert">
                    {saveError}
                  </p>
                )}
                <Button type="submit" variant="primary" className="self-start" busy={busy}>
                  Save timezone
                </Button>
                <AppearanceField
                  value={appearance}
                  onChange={setAppearance}
                  id="account-appearance"
                />
              </form>
            )}
            {profile && !confirmLogout && (
              <NotificationSettings
                key={dataVersion}
                session={session}
                timezone={profile.timezone}
                busy={pushBusy || logoutBusy}
                setBusy={setPushBusy}
                notify={notify}
              />
            )}
            {profile && !confirmLogout && (
              <PrivacySettings
                session={session}
                notify={notify}
                onChanged={() => {
                  setDataVersion((value) => value + 1);
                  setAttempt((value) => value + 1);
                }}
              />
            )}
            <div className="surface stack">
              <h2>Account</h2>
              <p className="secondary">Signed in as {session.email}</p>
              <Link className="text-link" href="/forgot-password">
                Change password
              </Link>
              {confirmLogout ? (
                <div className="stack">
                  <p>Sign out on all devices? This tab’s account data will be cleared.</p>
                  {supportsPush() && (
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={optOutOnLogout}
                        disabled={logoutBusy}
                        onChange={(event) => setOptOutOnLogout(event.target.checked)}
                      />
                      Turn off notifications on this device
                    </label>
                  )}
                  {logoutError && (
                    <p role="alert" className="error-text">
                      {logoutError}
                    </p>
                  )}
                  <div className="actions">
                    <Button disabled={logoutBusy} onClick={() => setConfirmLogout(false)}>
                      Stay signed in
                    </Button>
                    <Button variant="danger" busy={logoutBusy} onClick={() => void logout()}>
                      Confirm sign out
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  className="self-start"
                  disabled={pushBusy || logoutBusy}
                  onClick={() => setConfirmLogout(true)}
                >
                  Sign out
                </Button>
              )}
            </div>
          </div>
        </Dialog>
      )}
    </section>
  );
}

export function AccountPage({
  path,
  appearance,
  setAppearance,
  confirmationToken,
  discardConfirmation,
}: {
  path: string;
  appearance: Appearance;
  setAppearance: (value: Appearance) => void;
  confirmationToken: string | null;
  discardConfirmation: () => void;
}) {
  const state = useSyncExternalStore(sessionStore.subscribe, sessionStore.getSnapshot);
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    void loadAuthConfig(abort.signal).then(
      (value) => {
        if (!abort.signal.aborted) {
          setConfig(value);
          setLoading(false);
        }
      },
      () => {
        if (!abort.signal.aborted) {
          setConfig(null);
          setLoading(false);
        }
      },
    );
    return () => abort.abort();
  }, [attempt]);
  const client = useMemo(() => (config ? new AccountClient(config) : null), [config]);
  let content;
  if (path === '/confirm-email')
    content = (
      <ConfirmEmail client={client} token={confirmationToken} discardToken={discardConfirmation} />
    );
  else if (path === '/forgot-password') content = <RecoveryRequest client={client} />;
  else if (path === '/reset-password' || state.session?.recovery)
    content =
      client && state.session?.recovery ? (
        <ResetPassword key={state.session.accessToken} client={client} session={state.session} />
      ) : loading ? null : (
        <section className="login stack">
          <h1>A fresh link is needed.</h1>
          <p>This reset link is missing, invalid, expired, or already used.</p>
          <Link className="button button--primary" href="/forgot-password">
            Request a reset link
          </Link>
        </section>
      );
  else if (client && state.session)
    content = (
      <PrivateAccount
        key={state.session.accessToken}
        client={client}
        session={state.session}
        appearance={appearance}
        setAppearance={setAppearance}
      />
    );
  else if (path === '/create-account')
    content = config?.signup_enabled ? (
      <CredentialsForm key="signup" client={client} signup />
    ) : !loading && client ? (
      <section className="login stack">
        <h1>Registration is closed.</h1>
        <Link className="text-link" href="/">
          Back to sign in
        </Link>
      </section>
    ) : null;
  else
    content = (
      <CredentialsForm
        key="signin"
        client={client}
        loading={loading}
        signupEnabled={config?.signup_enabled ?? false}
      />
    );
  return (
    <>
      {state.notice && (
        <p role="status" className="notice">
          {state.notice}
        </p>
      )}
      {loading && <Loading label="Checking account access" />}
      {content}
      {!loading && !client && (
        <Button
          onClick={() => {
            setLoading(true);
            setAttempt((value) => value + 1);
          }}
        >
          Retry account connection
        </Button>
      )}
    </>
  );
}
