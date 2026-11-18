import type { components } from '../api/schema';
import { jsonRequest, AccountError, sessionStore, type Session } from '../auth/client';
export type Person = components['schemas']['Person'];
export type PersonInput = components['schemas']['PersonInput'];
export type Meetup = components['schemas']['Meetup'];

export async function journal<T>(
  session: Session,
  path: string,
  method = 'GET',
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  try {
    return (await jsonRequest('/api/' + path, {
      method,
      ...(signal ? { signal } : {}),
      headers: {
        Authorization: 'Bearer ' + session.accessToken,
        'Content-Type': 'application/json',
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })) as T;
  } catch (error) {
    if (
      error instanceof AccountError &&
      error.status === 401 &&
      sessionStore.getSnapshot().session?.accessToken === session.accessToken
    )
      sessionStore.clear('Your session ended. Sign in again.');
    throw error;
  }
}
export function failureMessage(error: unknown) {
  return error instanceof AccountError && error.status === 409
    ? 'This record changed in another tab. Close this form and refresh before editing again.'
    : error instanceof AccountError && error.status === 422
      ? 'Check the date and form values. Completed meetups cannot be in the future.'
      : 'The request could not be confirmed. Your form is kept here; check your connection and try again.';
}
