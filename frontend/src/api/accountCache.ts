import { QueryCache, QueryClient } from '@tanstack/react-query';

export const profileKey = ['profile'] as const;
export const peopleKey = ['people'] as const;
export const meetupKey = ['meetups'] as const;
export const deviceKey = ['notification-device'] as const;

export function createAccountCache(onError: (error: unknown) => void) {
  const day = 24 * 60 * 60 * 1000;
  return new QueryClient({
    queryCache: new QueryCache({ onError }),
    defaultOptions: {
      queries: {
        staleTime: day,
        gcTime: day,
        retry: false,
        refetchOnReconnect: false,
        networkMode: 'always',
      },
    },
  });
}
