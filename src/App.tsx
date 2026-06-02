import { useMemo, useState } from 'react';
import { AUFGABEN } from './data/tasks';
import { Dashboard } from './components/Dashboard';
import { TaskDetail } from './components/TaskDetail';
import { useFortschritt } from './hooks/useFortschritt';

export default function App() {
  const [aktiv, setAktiv] = useState<string | null>(null);
  const {
    fortschritt,
    durchfuehrungHinzufuegen,
    durchfuehrungEntfernen,
    zielanzahlSetzen,
    nichtAnwendbarSetzen,
  } = useFortschritt();

  const heute = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const aufgabe = aktiv ? AUFGABEN.find((a) => a.id === aktiv) ?? null : null;

  if (aufgabe) {
    return (
      <main className="app">
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
      </main>
    );
  }

  return (
    <main className="app">
      <Dashboard fortschritt={fortschritt} onSelect={setAktiv} />
    </main>
  );
}
