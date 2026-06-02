import type { Aufgabe } from '../data/tasks';
import {
  type AufgabenFortschritt,
  type Durchfuehrung,
  aufgabenStatus,
} from '../domain/progress';
import { DurchfuehrungForm } from './DurchfuehrungForm';

type Props = {
  aufgabe: Aufgabe;
  fortschritt: AufgabenFortschritt;
  heute: string;
  onAdd: (eintrag: Omit<Durchfuehrung, 'id'>) => void;
  onRemove: (eintragId: string) => void;
  onZielanzahl: (ziel: number) => void;
  onNichtAnwendbar: (wert: boolean) => void;
  onBack: () => void;
};

export function TaskDetail({
  aufgabe,
  fortschritt,
  heute,
  onAdd,
  onRemove,
  onZielanzahl,
  onNichtAnwendbar,
  onBack,
}: Props) {
  const status = aufgabenStatus(fortschritt);
  const istTeil23 = aufgabe.teil !== 1;

  return (
    <article className="detail">
      <button className="zurueck" onClick={onBack}>← Übersicht</button>
      <h2>
        Aufgabe {aufgabe.nummer} – {aufgabe.titel}
      </h2>

      <ol className="schritte">
        {aufgabe.schritte.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>

      <p className="lernziel">{aufgabe.lernziel}</p>

      {aufgabe.durchfuehrungshinweise.length > 0 && (
        <>
          <h3>Durchführungshinweise</h3>
          <ul>
            {aufgabe.durchfuehrungshinweise.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ul>
        </>
      )}

      {aufgabe.sicherheitshinweise.length > 0 && (
        <div className="warnung" role="note">
          <strong>Sicherheitshinweise</strong>
          <ul>
            {aufgabe.sicherheitshinweise.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ul>
        </div>
      )}

      {istTeil23 && (
        <label className="na-toggle">
          <input
            type="checkbox"
            checked={fortschritt.nichtAnwendbar}
            onChange={(e) => onNichtAnwendbar(e.target.checked)}
          />
          Nicht anwendbar (nicht mit unserem Einsatzsystem umsetzbar)
        </label>
      )}

      {!fortschritt.nichtAnwendbar && (
        <section className="erfassung">
          <h3>
            Durchführungen ({fortschritt.durchfuehrungen.length} / {fortschritt.zielanzahl})
            {status === 'erledigt' && ' ✓'}
          </h3>

          <label className="ziel">
            Zielanzahl
            <input
              type="number"
              min={1}
              value={fortschritt.zielanzahl}
              onChange={(e) => onZielanzahl(Number(e.target.value))}
            />
          </label>

          <ul className="liste">
            {fortschritt.durchfuehrungen.map((d) => (
              <li key={d.id}>
                <span>
                  {d.datum} · {d.drohnensteuerer || '—'} / {d.luftraumbeobachter || '—'}
                </span>
                <button onClick={() => onRemove(d.id)} aria-label="Eintrag löschen">
                  ✕
                </button>
              </li>
            ))}
          </ul>

          <DurchfuehrungForm onAdd={onAdd} heute={heute} />
        </section>
      )}
    </article>
  );
}
