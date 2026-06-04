import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { syncEngine } from './offline/syncEngine';
import { TeilnehmerApp } from './pages/TeilnehmerApp';
import { StartPage } from './pages/StartPage';
import { LoginPage } from './pages/LoginPage';
import { AdminApp } from './admin/AdminApp';

/**
 * Startet die Offline-Sync-Engine ausschließlich für eingeloggte Teilnehmer
 * (§9: anonymer Modus bleibt rein lokal, Admin synchronisiert keinen Fortschritt).
 * `start()` liefert die Stop-Funktion, die als Effekt-Cleanup bei Logout und im
 * StrictMode-Doppellauf greift.
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
 * Startseite (/): Teilnehmer-Dashboard, sobald ein Teilnehmer eingeloggt ist oder
 * der anonyme lokale Übungsmodus gewählt wurde; andernfalls die Zugangsauswahl.
 * Während `/api/me` initial lädt, wird nichts gezeigt, damit für eingeloggte
 * Teilnehmer nicht kurz die Auswahl aufblitzt.
 */
function HomeRoute({ lokal, onLokalStart }: { lokal: boolean; onLokalStart: () => void }) {
  const { identity, laden } = useAuth();
  if (identity.kind === 'participant' || lokal) return <TeilnehmerApp />;
  if (laden) return <main className="app" aria-busy="true" />;
  return <StartPage onLokalStart={onLokalStart} />;
}

function AppRoutes() {
  // Session-State: Der lokale Modus überlebt Navigation (z. B. nach /aufgabe/:id
  // und zurück), aber bewusst keinen Reload — beim Neustart erscheint wieder die
  // Zugangsauswahl. Liegt über <Routes>, damit er nicht beim Routenwechsel verfällt.
  const [lokal, setLokal] = useState(false);
  return (
    <>
      <SyncStarter />
      <Routes>
        <Route
          path="/"
          element={<HomeRoute lokal={lokal} onLokalStart={() => setLokal(true)} />}
        />
        <Route path="/aufgabe/:taskId" element={<TeilnehmerApp />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/admin/*" element={<AdminApp />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
