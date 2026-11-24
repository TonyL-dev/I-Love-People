import { useEffect, useState, type FormEvent } from 'react';
import type { Session } from '../auth/client';
import { Button } from '../ui/Button';
import { Loading } from '../ui/Loading';
import {
  applicationKey,
  defaultDeviceSettings,
  disableDevice,
  pushConfig,
  pushStatus,
  saveDevice,
  supportsPush,
  type DeviceStatus,
} from './client';

type Device = {
  registration: ServiceWorkerRegistration | undefined;
  subscription: PushSubscription | null;
  publicKey: string | null;
  enrolled: boolean;
};

const formatTime = (minutes: number) =>
  [Math.floor(minutes / 60), minutes % 60].map((part) => String(part).padStart(2, '0')).join(':');

function minutes(value: string) {
  const [hour = 0, minute = 0] = value.split(':').map(Number);
  return hour * 60 + minute;
}

function displaySettings(settings: DeviceStatus) {
  return {
    start: formatTime(settings.quiet_start),
    end: formatTime(settings.quiet_end),
    showName: settings.show_name ?? false,
  };
}

export function NotificationSettings({
  session,
  timezone,
  setBusy,
  busy,
  notify,
}: {
  session: Session;
  timezone: string;
  setBusy: (busy: boolean) => void;
  busy: boolean;
  notify: (message: string) => void;
}) {
  const [device, setDevice] = useState<Device | null>(null);
  const [settings, setSettings] = useState(() => displaySettings(defaultDeviceSettings));
  const [permission, setPermission] = useState(() =>
    'Notification' in window ? Notification.permission : 'default',
  );
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const appleMobile =
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const supported = supportsPush() && (!appleMobile || standalone);

  useEffect(() => {
    if (!supported) return;
    const abort = new AbortController();
    async function load() {
      const registration = await navigator.serviceWorker.getRegistration('/');
      const config = registration ? await pushConfig(session, abort.signal) : null;
      const subscription = (await registration?.pushManager?.getSubscription()) ?? null;
      const status = subscription ? await pushStatus(session, subscription, abort.signal) : null;
      if (abort.signal.aborted) return;
      setDevice({
        registration,
        subscription,
        publicKey: config?.public_key ?? null,
        enrolled: !!status,
      });
      setSettings(displaySettings(status ?? defaultDeviceSettings));
    }
    void load().catch(() => {
      if (!abort.signal.aborted) setError('Notification settings could not be loaded.');
    });
    return () => abort.abort();
  }, [supported, session, reload]);

  useEffect(() => {
    const refresh = () => {
      if ('Notification' in window) setPermission(Notification.permission);
    };
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);

  async function enable() {
    if (!device?.registration?.active || !device.publicKey || busy) return;
    setBusy(true);
    setError('');
    try {
      const key = applicationKey(device.publicKey);
      if (device.subscription?.options.applicationServerKey) {
        const old = new Uint8Array(device.subscription.options.applicationServerKey);
        if (old.length !== key.length || old.some((value, index) => value !== key[index])) {
          setError('Turn off notifications on this device, then enable them again.');
          return;
        }
      }
      // Subscribe directly from the gesture. The browser presents the permission prompt.
      const subscription =
        device.subscription ??
        (await device.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: key,
        }));
      setDevice({ ...device, subscription });
      const saved = await saveDevice(session, subscription, defaultDeviceSettings);
      setSettings(displaySettings(saved));
      setDevice({ ...device, subscription, enrolled: true });
      notify('Notifications are enabled on this device.');
    } catch {
      if (Notification.permission !== 'denied')
        setError('Notifications could not be enabled. Check your connection and browser settings.');
    } finally {
      setPermission(Notification.permission);
      setBusy(false);
    }
  }

  async function saveSettings(event: FormEvent) {
    event.preventDefault();
    if (!device?.subscription || busy) return;
    if (settings.start === settings.end) {
      setError('Choose different start and end times.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const saved = await saveDevice(session, device.subscription, {
        quiet_start: minutes(settings.start),
        quiet_end: minutes(settings.end),
        show_name: settings.showName,
      });
      setSettings(displaySettings(saved));
      notify('Notification settings saved.');
    } catch {
      setError('Notification settings could not be saved. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    if (!device || busy) return;
    setBusy(true);
    setError('');
    try {
      await disableDevice(session);
      setDevice({ ...device, subscription: null, enrolled: false });
      notify('Notifications are off on this device.');
    } catch {
      setError('Notifications could not be turned off. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="surface stack" aria-labelledby="device-notifications">
      <h2 id="device-notifications">Notifications on this device</h2>
      {!standalone && (
        <p className="secondary">
          On iPhone, open Safari, choose Share, then Add to Home Screen. Open the new icon and sign
          in. On desktop, use your browser’s install option if available.
        </p>
      )}
      <p className="secondary">A reminder may appear while the app is closed.</p>
      {!supported ? (
        <p>
          {appleMobile
            ? 'Open from the Home Screen to enable notifications.'
            : 'This browser does not support notifications.'}
        </p>
      ) : permission === 'denied' ? (
        <p>
          Notifications are blocked. Allow them in your device or browser settings to turn them on
          again.
        </p>
      ) : !device && !error ? (
        <Loading label="Checking notification settings" />
      ) : device?.registration && !device.publicKey ? (
        <p>External reminders are currently unavailable. You can still use Catch up in the app.</p>
      ) : device?.enrolled ? (
        <p>Enabled on this device.</p>
      ) : device?.registration?.active ? (
        <>
          {device.subscription && (
            <p>This subscription is inactive. Enable it again to receive reminders.</p>
          )}
          <Button
            variant="primary"
            className="self-start"
            busy={busy}
            onClick={() => void enable()}
          >
            Enable on this device
          </Button>
        </>
      ) : device ? (
        <>
          <p>The app is still getting ready. Try checking again.</p>
          <Button className="self-start" onClick={() => setReload((value) => value + 1)}>
            Check again
          </Button>
        </>
      ) : null}
      {device?.enrolled && permission === 'granted' && device.publicKey && (
        <form className="stack" onSubmit={(event) => void saveSettings(event)}>
          <p className="supporting secondary">
            Quiet hours follow your account timezone ({timezone}).
          </p>
          <label>
            Quiet hours start
            <input
              type="time"
              value={settings.start}
              required
              disabled={busy}
              onChange={(event) => setSettings({ ...settings, start: event.target.value })}
            />
          </label>
          <label>
            Quiet hours end
            <input
              type="time"
              value={settings.end}
              required
              disabled={busy}
              onChange={(event) => setSettings({ ...settings, end: event.target.value })}
            />
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={settings.showName}
              disabled={busy}
              aria-describedby="notification-name-help"
              onChange={(event) => setSettings({ ...settings, showName: event.target.checked })}
            />
            Show a name in reminders
          </label>
          <p id="notification-name-help" className="supporting secondary">
            The name may appear on your lock screen.
          </p>
          <Button className="self-start" type="submit" busy={busy}>
            Save notification settings
          </Button>
        </form>
      )}
      {device?.subscription && (
        <Button className="self-start" busy={busy} onClick={() => void disable()}>
          Turn off on this device
        </Button>
      )}
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      {error && !device && (
        <Button
          className="self-start"
          onClick={() => {
            setError('');
            setReload((value) => value + 1);
          }}
        >
          Retry notification settings
        </Button>
      )}
    </section>
  );
}
