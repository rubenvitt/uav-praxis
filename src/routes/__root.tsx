import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import type { QueryClient } from '@tanstack/react-query';
import type { AuthContextValue } from '../auth/AuthContext';

/**
 * Router-Context: `queryClient` für Admin-Loader (Phase 2), `auth` als typisierter
 * Lese-Zugriff. Wichtig: Das Auth-GATING bleibt render-seitig in den Layout-
 * Komponenten (kein `beforeLoad`-Redirect) — der asynchrone `laden`-Zustand würde
 * sonst kurz die Login-Seite aufblitzen lassen. Die API-Auth ist Cookie-basiert
 * (`credentials: 'include'`) und damit vom React-`auth`-State entkoppelt: Admin-
 * Loader (Phase 2) gelingen schon, während `auth.laden` noch true ist.
 */
export interface RouterContext {
  queryClient: QueryClient;
  auth: AuthContextValue;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: () => <Outlet />,
});
