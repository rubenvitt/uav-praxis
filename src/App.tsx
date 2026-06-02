import { useMemo, useState } from 'react';
import { AUFGABEN } from './data/tasks';
import { Dashboard } from './components/Dashboard';
import { TaskDetail } from './components/TaskDetail';
import { useFortschritt } from './hooks/useFortschritt';

export default function App() {
  const [aktiv, setAktiv] = useState<string | null>(null);
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

  return (
    <main className="app">
      {speicherfehler && (
        <div className="speicher-warnung" role="alert">
          Achtung: Der Fortschritt kann nicht gespeichert werden (Speicher voll oder nicht
          verfügbar). Eingaben gehen beim Schließen der App verloren.
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
          onBack={() => setAktiv(null)}
        />
      ) : (
        <Dashboard fortschritt={fortschritt} onSelect={setAktiv} />
      )}
    </main>
  );
}
