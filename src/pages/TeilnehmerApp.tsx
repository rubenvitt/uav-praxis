import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Dashboard } from '../components/Dashboard';
import { TaskDetail } from '../components/TaskDetail';
import { useFortschritt } from '../hooks/useFortschritt';
import { useKatalog } from '../hooks/useKatalog';
import { syncEngine, type SyncStatus } from '../offline/syncEngine';

const STATUS_TEXT: Record<SyncStatus, string> = {
  online: 'Online',
  offline: 'Offline — Änderungen werden gespeichert',
  syncing: 'Synchronisiere …',
  synced: 'Synchronisiert',
  fehler: 'Sync fehlgeschlagen — wird wiederholt',
};

function SyncIndikator() {
  const [status, setStatus] = useState<SyncStatus>(() => syncEngine.statusLesen());
  useEffect(() => syncEngine.abonnieren(setStatus), []);
  return (
    <div className={`sync-indikator sync-${status}`} role="status" aria-live="polite">
      <span className="sync-punkt" aria-hidden="true" />
      {STATUS_TEXT[status]}
    </div>
  );
}

export function TeilnehmerApp({ taskId }: { taskId?: string }) {
  const navigate = useNavigate();
  const aktiv = taskId ?? null;
  const katalog = useKatalog();
  const {
    speicherfehler,
    fortschritt,
    durchfuehrungHinzufuegen,
    durchfuehrungEntfernen,
    zielanzahlSetzen,
    nichtAnwendbarSetzen,
  } = useFortschritt(katalog);

  const heute = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const aufgabe = aktiv ? katalog.find((a) => a.id === aktiv) ?? null : null;

  // Unbekannte Aufgaben-ID in der URL (z. B. veralteter Deep-Link) → zurück zum
  // Dashboard, ohne einen zusätzlichen History-Eintrag zu erzeugen.
  useEffect(() => {
    if (aktiv && !aufgabe) navigate({ to: '/', replace: true });
  }, [aktiv, aufgabe, navigate]);

  return (
    <main className="app">
      {speicherfehler && (
        <div className="speicher-warnung" role="alert">
          <strong className="warnung-titel">Fortschritt nicht gespeichert</strong>
          <p>
            Der Fortschritt kann nicht gespeichert werden (Speicher voll oder nicht verfügbar).
            Eingaben gehen beim Schließen der App verloren.
          </p>
        </div>
      )}

      {aufgabe ? (
        <TaskDetail
          aufgabe={aufgabe}
          fortschritt={fortschritt[aufgabe.id]}
          heute={heute}
          onAdd={(e) => durchfuehrungHinzufuegen(aufgabe.id, e)}
          onRemove={(eid) => durchfuehrungEntfernen(aufgabe.id, eid)}
          onZielanzahl={(z) => zielanzahlSetzen(aufgabe.id, z)}
          onNichtAnwendbar={(w) => nichtAnwendbarSetzen(aufgabe.id, w)}
          onBack={() => navigate({ to: '/' })}
        />
      ) : (
        <Dashboard
          katalog={katalog}
          fortschritt={fortschritt}
          onSelect={(id) => navigate({ to: '/aufgabe/$taskId', params: { taskId: id } })}
        />
      )}

      <SyncIndikator />
    </main>
  );
}

export default TeilnehmerApp;
