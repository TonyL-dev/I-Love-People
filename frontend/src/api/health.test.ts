import { describe, expect, it, vi } from 'vitest';
import { fetchHealth } from './health';

describe('health contract boundary', () => {
  it('rejects a successful HTTP response with an incompatible contract', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 'ready' }))),
    );
    await expect(fetchHealth(new AbortController().signal)).rejects.toThrow('unexpected response');
    vi.unstubAllGlobals();
  });
  it('uses a relative no-store request and accepts the generated health shape', async () => {
    const request = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ status: 'ok', service: 'i-love-people-api' })),
      );
    vi.stubGlobal('fetch', request);
    const signal = new AbortController().signal;
    await expect(fetchHealth(signal)).resolves.toEqual({
      status: 'ok',
      service: 'i-love-people-api',
    });
    expect(request).toHaveBeenCalledWith('/api/health', {
      signal,
      cache: 'no-store',
      credentials: 'same-origin',
    });
    vi.unstubAllGlobals();
  });
});
