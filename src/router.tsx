import { createRouter } from '@tanstack/react-router';
import { QueryClient } from '@tanstack/react-query';
import { routeTree } from './routeTree.gen';

/** Globaler Query-Client (Provider in App; zusätzlich in den Router-Context injiziert). */
export const queryClient = new QueryClient();

export const router = createRouter({
  routeTree,
  // Router-eigenen SWR-Cache nicht vor Querys Frische-Logik schalten (Phase 2).
  defaultPreloadStaleTime: 0,
  context: {
    queryClient,
    // `auth` wird zur Laufzeit reaktiv über <RouterProvider context={{ auth }}> gesetzt.
    auth: undefined!,
  },
});

// Einzige nötige Typ-Registrierung der App: macht Link/useNavigate/useSearch/useParams typsicher.
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
