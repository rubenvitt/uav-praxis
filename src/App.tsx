import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { syncEngine } from './offline/syncEngine';
import { TeilnehmerApp } from './pages/TeilnehmerApp';
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

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SyncStarter />
        <Routes>
          <Route path="/" element={<TeilnehmerApp />} />
          <Route path="/aufgabe/:taskId" element={<TeilnehmerApp />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/admin/*" element={<AdminApp />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
