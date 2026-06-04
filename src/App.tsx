import { useEffect } from 'react';
import { RouterProvider } from '@tanstack/react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { LokalProvider } from './lokal/LokalContext';
import { syncEngine } from './offline/syncEngine';
import { router, queryClient } from './router';

/**
 * Startet die Offline-Sync-Engine ausschließlich für eingeloggte Teilnehmer
 * (§9: anonymer Modus bleibt rein lokal, Admin synchronisiert keinen Fortschritt).
 * `start()` liefert die Stop-Funktion (Cleanup bei Logout / StrictMode-Doppellauf).
 */
function SyncStarter() {
  const { identity } = useAuth();
  useEffect(() => {
    if (identity.kind !== 'participant') return;
    return syncEngine.start();
  }, [identity.kind]);
  return null;
}

/**
 * Rendert den Router und injiziert die LIVE-Identität in den Router-Context
 * (typisierter Lese-Zugriff in Loadern). Muss `useAuth` aufrufen → innerhalb des
 * AuthProvider. Reexport für Tests, damit dort derselbe Pfad mit Memory-History läuft.
 */
export function RouterMitAuth() {
  const auth = useAuth();
  return <RouterProvider router={router} context={{ auth }} />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SyncStarter />
        <LokalProvider>
          <RouterMitAuth />
        </LokalProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
