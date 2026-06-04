import { useMemo } from 'react';
import type { TaskDTO } from '../../shared/types';
import { type AufgabenFortschritt, gesamtFortschritt } from '../domain/progress';
import { TaskCard } from './TaskCard';

const TEILE: { teil: 1 | 2 | 3; titel: string }[] = [
  { teil: 1, titel: 'Teil 1 · Grundlegende Steuerung' },
  { teil: 2, titel: 'Teil 2 · Sichere Steuerung in einsatznahen Situationen' },
  { teil: 3, titel: 'Teil 3 · Training von Einsatzszenarien' },
];

type Props = {
  katalog: TaskDTO[];
  fortschritt: Record<string, AufgabenFortschritt>;
  onSelect: (id: string) => void;
};

export function Dashboard({ katalog, fortschritt, onSelect }: Props) {
  // Gesamtfortschritt nur über die aktuell sichtbaren Katalog-Aufgaben rechnen —
  // ein lokaler Stand für inzwischen deaktivierte/entfernte Aufgaben zählt nicht mit.
  const sichtbarerFortschritt = useMemo(() => {
    const map: Record<string, AufgabenFortschritt> = {};
    for (const t of katalog) {
      const f = fortschritt[t.id];
      if (f) map[t.id] = f;
    }
    return map;
  }, [katalog, fortschritt]);
  const { erledigt, gesamt } = gesamtFortschritt(sichtbarerFortschritt);
  const prozent = gesamt === 0 ? 0 : Math.round((erledigt / gesamt) * 100);

  return (
    <div className="dashboard">
      <header className="kopf">
        <p className="eyebrow">Training · BOS</p>
        <h1 className="kopf-titel">Drohnen-Trainingsbegleiter</h1>
      </header>

      <section className="fortschritt-karte" aria-label="Gesamtfortschritt">
        <div className="fortschritt-zahl">{prozent}%</div>
        <p className="fortschritt-sub">
          Gesamtfortschritt · {erledigt} von {gesamt} Aufgaben
        </p>
        <div className="balken">
          <div className="balken-fuell" style={{ width: `${prozent}%` }} />
        </div>
      </section>

      {TEILE.map(({ teil, titel }) => (
        <section key={teil} className="teil-sektion">
          <h2 className="sektion-titel">{titel}</h2>
          <div className="aufgaben-liste">
            {katalog.filter((a) => a.teil === teil).map((a) => (
              <TaskCard
                key={a.id}
                aufgabe={a}
                fortschritt={fortschritt[a.id]}
                onSelect={onSelect}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
