import type { Aufgabe } from '../data/tasks';
import {
  type AufgabenFortschritt,
  type Durchfuehrung,
  aufgabenStatus,
} from '../domain/progress';
import { DurchfuehrungForm } from './DurchfuehrungForm';

type Props = {
  aufgabe: Aufgabe & { bildUrl?: string | null; bild?: string | null };
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
  const bild = aufgabe.bildUrl ?? aufgabe.bild ?? null;

  // Alt-Text: Titel + knappe Lernziel-/Motiv-Kurzfassung (§14), auf eine kurze,
  // gut vorlesbare Länge gekappt.
  const motiv = aufgabe.lernziel?.trim().replace(/\s+/g, ' ') ?? '';
  const motivKurz = motiv.length > 120 ? `${motiv.slice(0, 117).trimEnd()}…` : motiv;
  const bildAlt = motivKurz
    ? `Illustration zu „${aufgabe.titel}“ – ${motivKurz}`
    : `Illustration zu „${aufgabe.titel}“`;

  return (
    <article className="detail">
      <button type="button" className="zurueck" onClick={onBack}>
        ← Übersicht
      </button>

      <p className="eyebrow">Aufgabe {aufgabe.nummer}</p>
      <h2 className="detail-titel">{aufgabe.titel}</h2>

      {bild && (
        <img className="detail-bild" src={bild} loading="lazy" alt={bildAlt} />
      )}

      <ol className="schritte">
        {aufgabe.schritte.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>

      <p className="lernziel">{aufgabe.lernziel}</p>

      {aufgabe.durchfuehrungshinweise.length > 0 && (
        <section className="hinweise">
          <h3 className="sektion-titel">Durchführungshinweise</h3>
          <ul>
            {aufgabe.durchfuehrungshinweise.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ul>
        </section>
      )}

      {aufgabe.sicherheitshinweise.length > 0 && (
        <div className="warnung" role="note">
          <strong className="warnung-titel">Sicherheitshinweise</strong>
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
          <span>Nicht anwendbar (nicht mit unserem Einsatzsystem umsetzbar)</span>
        </label>
      )}

      {!fortschritt.nichtAnwendbar && (
        <section className="erfassung">
          <header className="erfassung-kopf">
            <h3 className="sektion-titel">
              Durchführungen {fortschritt.durchfuehrungen.length} / {fortschritt.zielanzahl}
            </h3>
            {status === 'erledigt' && <span className="erledigt-marke">erledigt</span>}
          </header>

          <label className="feld ziel">
            <span className="feld-label">Zielanzahl</span>
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
                <span className="liste-text">
                  {d.datum} · {d.drohnensteuerer || '—'} / {d.luftraumbeobachter || '—'}
                </span>
                <button
                  type="button"
                  className="loeschen"
                  onClick={() => {
                    if (window.confirm('Diese Durchführung wirklich löschen?')) onRemove(d.id);
                  }}
                  aria-label="Eintrag löschen"
                >
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
