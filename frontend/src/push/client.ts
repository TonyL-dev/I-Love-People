import { jsonRequest, type Session } from '../auth/client';
import type { components } from '../api/schema';

export type DeviceStatus = components['schemas']['DeviceStatus'];
type PushConfig = components['schemas']['PushConfig'];
type Enrollment = components['schemas']['Enrollment'];

export const defaultDeviceSettings: DeviceStatus = {
  quiet_start: 21 * 60,
  quiet_end: 9 * 60,
  show_name: false,
};

export function pushConfig(session: Session, signal: AbortSignal) {
  return pushRequest<PushConfig>(session, 'config', 'GET', undefined, signal);
}

export function pushStatus(session: Session, subscription: PushSubscription, signal: AbortSignal) {
  return pushRequest<DeviceStatus | null>(
    session,
    'status',
    'POST',
    {
      endpoint: subscription.endpoint,
    },
    signal,
  );
}

export function saveDevice(
  session: Session,
  subscription: PushSubscription,
  settings: DeviceStatus,
) {
  const keys = subscription.toJSON().keys;
  if (!keys?.p256dh || !keys.auth) throw new Error('This browser returned incomplete settings.');
  const device: Enrollment = {
    ...settings,
    endpoint: subscription.endpoint,
    p256dh: keys.p256dh,
    auth: keys.auth,
  };
  return pushRequest<DeviceStatus>(session, 'device', 'PUT', device);
}

async function pushRequest<T>(
  session: Session,
  path: string,
  method: string,
  data?: object,
  signal?: AbortSignal,
): Promise<T> {
  return (await jsonRequest('/api/push/' + path, {
    method,
    signal: signal ?? null,
    headers: {
      Authorization: 'Bearer ' + session.accessToken,
      'Content-Type': 'application/json',
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
  })) as T;
}

export function supportsPush() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export async function disableDevice(session: Session) {
  if (!supportsPush()) return;
  const registration = await navigator.serviceWorker.getRegistration('/');
  const subscription = await registration?.pushManager?.getSubscription();
  if (!subscription) return;
  await pushRequest<null>(session, 'unsubscribe', 'POST', { endpoint: subscription.endpoint });
  await subscription.unsubscribe();
}

export function applicationKey(encoded: string): Uint8Array<ArrayBuffer> {
  const base64 = encoded.replaceAll('-', '+').replaceAll('_', '/');
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}
