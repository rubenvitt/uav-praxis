import type { Aufgabe } from '../data/tasks';
import { type AufgabenFortschritt, aufgabenStatus } from '../domain/progress';

type Props = {
  aufgabe: Aufgabe;
  fortschritt: AufgabenFortschritt;
  onSelect: (id: string) => void;
};

export function TaskCard({ aufgabe, fortschritt, onSelect }: Props) {
  const status = aufgabenStatus(fortschritt);
  return (
    <button
      type="button"
      className={`aufgabe-zeile status-${status}`}
      onClick={() => onSelect(aufgabe.id)}
    >
      <span className="aufgabe-nummer">{aufgabe.nummer}</span>
      <span className="aufgabe-titel">{aufgabe.titel}</span>
      {status === 'erledigt' ? (
        <span className="aufgabe-badge badge-erledigt">erledigt</span>
      ) : status === 'nicht-anwendbar' ? (
        <span className="aufgabe-badge badge-na">nicht anwendbar</span>
      ) : (
        <span className="aufgabe-badge badge-zaehler">
          {fortschritt.durchfuehrungen.length} / {fortschritt.zielanzahl}
        </span>
      )}
    </button>
  );
}
