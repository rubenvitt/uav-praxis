import {
  createMemoryHistory,
  createRouter,
  type AnyRouter,
} from '@tanstack/react-router';
import { QueryClient } from '@tanstack/react-query';
import { routeTree } from '../routeTree.gen';

/**
 * Baut einen frischen Router auf Memory-History (für Tests) aus dem ECHTEN
 * routeTree. Liefert zusätzlich einen retry-freien QueryClient (Phase 2). Die
 * Auth-Identität wird hier NICHT injiziert — Tests umschließen den Router je nach
 * Bedarf mit echtem `AuthProvider` (App.test) oder gemocktem `useAuth` (LoginPage.test).
 */
export function createTestRouter(initialLocation: string): {
  router: AnyRouter;
  queryClient: QueryClient;
} {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const router = createRouter({
    routeTree,
    defaultPreloadStaleTime: 0,
    history: createMemoryHistory({ initialEntries: [initialLocation] }),
    context: { queryClient, auth: undefined! },
  });
  return { router, queryClient };
}
