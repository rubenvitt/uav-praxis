import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AUFGABEN } from '../data/tasks';
import { Dashboard } from '../components/Dashboard';
import { TaskDetail } from '../components/TaskDetail';
import { useFortschritt } from '../hooks/useFortschritt';
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

export function TeilnehmerApp() {
  const navigate = useNavigate();
  const { taskId } = useParams<{ taskId: string }>();
  const aktiv = taskId ?? null;
  const {
    speicherfehler,
    fortschritt,
    durchfuehrungHinzufuegen,
    durchfuehrungEntfernen,
    zielanzahlSetzen,
    nichtAnwendbarSetzen,
  } = useFortschritt();

  const heute = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const aufgabe = aktiv ? AUFGABEN.find((a) => a.id === aktiv) ?? null : null;

  // Unbekannte Aufgaben-ID in der URL (z. B. veralteter Deep-Link) → zurück zum
  // Dashboard, ohne einen zusätzlichen History-Eintrag zu erzeugen.
  useEffect(() => {
    if (aktiv && !aufgabe) navigate('/', { replace: true });
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
          aufgabe={{ ...aufgabe, bildUrl: `/illustrations/${aufgabe.id}.webp` }}
          fortschritt={fortschritt[aufgabe.id]}
          heute={heute}
          onAdd={(e) => durchfuehrungHinzufuegen(aufgabe.id, e)}
          onRemove={(eid) => durchfuehrungEntfernen(aufgabe.id, eid)}
          onZielanzahl={(z) => zielanzahlSetzen(aufgabe.id, z)}
          onNichtAnwendbar={(w) => nichtAnwendbarSetzen(aufgabe.id, w)}
          onBack={() => navigate('/')}
        />
      ) : (
        <Dashboard fortschritt={fortschritt} onSelect={(id) => navigate(`/aufgabe/${id}`)} />
      )}

      <SyncIndikator />
    </main>
  );
}

export default TeilnehmerApp;
