import { QueryClient, queryOptions } from '@tanstack/react-query';

const day = 24 * 60 * 60 * 1000;

export function createSessionCache() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: day, gcTime: day, retry: false, refetchOnReconnect: false },
    },
  });
}

export async function disposeSessionCache(cache: QueryClient) {
  await cache.cancelQueries();
  cache.clear();
}

type Project = { id: string; name: string };

export const projectKeys = {
  lists: ['projects', 'list'] as const,
  detail: (id: string) => ['projects', 'detail', id] as const,
};

export function projectQuery(
  id: string,
  read: (id: string, signal: AbortSignal) => Promise<Project>,
) {
  return queryOptions({
    queryKey: projectKeys.detail(id),
    queryFn: ({ signal }) => read(id, signal),
  });
}

export function updateSavedProject(cache: QueryClient, saved: Project) {
  cache.setQueryData(projectKeys.detail(saved.id), saved);
  return cache.invalidateQueries({ queryKey: projectKeys.lists });
}
