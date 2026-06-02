import type { Aufgabe } from '../data/tasks';
import { type AufgabenFortschritt, aufgabenStatus } from '../domain/progress';

const LABEL: Record<string, string> = {
  offen: 'offen',
  erledigt: 'erledigt',
  'nicht-anwendbar': 'n. a.',
};

type Props = {
  aufgabe: Aufgabe;
  fortschritt: AufgabenFortschritt;
  onSelect: (id: string) => void;
};

export function TaskCard({ aufgabe, fortschritt, onSelect }: Props) {
  const status = aufgabenStatus(fortschritt);
  return (
    <button className={`card status-${status}`} onClick={() => onSelect(aufgabe.id)}>
      <span className="nummer">{aufgabe.nummer}</span>
      <span className="titel">{aufgabe.titel}</span>
      <span className="meta">
        {status !== 'nicht-anwendbar' && (
          <span className="zaehler">
            {fortschritt.durchfuehrungen.length} / {fortschritt.zielanzahl}
          </span>
        )}
        <span className="badge">{LABEL[status]}</span>
      </span>
    </button>
  );
}
