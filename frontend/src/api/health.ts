import type { paths } from './schema';

type Health = paths['/api/health']['get']['responses'][200]['content']['application/json'];

export async function fetchHealth(signal: AbortSignal): Promise<Health> {
  const response = await fetch('/api/health', { signal, cache: 'no-store', credentials: 'omit' });
  if (!response.ok) throw new Error('The API could not be reached.');
  const value: unknown = await response.json();
  if (
    !value ||
    typeof value !== 'object' ||
    !('status' in value) ||
    value.status !== 'ok' ||
    !('service' in value) ||
    value.service !== 'i-love-people-api'
  )
    throw new Error('The API returned an unexpected response.');
  return { status: value.status, service: value.service };
}
