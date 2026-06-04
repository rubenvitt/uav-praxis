import { useState, type FormEvent } from 'react';
import type { Durchfuehrung } from '../domain/progress';
import { useLocalStorage } from '../hooks/useLocalStorage';

type Props = {
  onAdd: (eintrag: Omit<Durchfuehrung, 'id'>) => void;
  heute: string;
};

type Team = { drohnensteuerer: string; luftraumbeobachter: string };
const LEERES_TEAM: Team = { drohnensteuerer: '', luftraumbeobachter: '' };

export function DurchfuehrungForm({ onAdd, heute }: Props) {
  // Zuletzt erfasstes Team aufgaben- und sitzungsübergreifend merken, damit die
  // beiden Namensfelder beim nächsten Eintrag bereits vorbelegt sind.
  const [letztesTeam, setLetztesTeam] = useLocalStorage<Team>('df:letztes-team', LEERES_TEAM);
  const [datum, setDatum] = useState(heute);
  const [drohnensteuerer, setDrohnensteuerer] = useState(letztesTeam.drohnensteuerer);
  const [luftraumbeobachter, setLuftraumbeobachter] = useState(letztesTeam.luftraumbeobachter);

  function absenden(e: FormEvent) {
    e.preventDefault();
    onAdd({ datum, drohnensteuerer, luftraumbeobachter });
    setLetztesTeam({ drohnensteuerer, luftraumbeobachter });
    setDatum(heute);
    // Namensfelder bleiben als Vorbelegung für die nächste Durchführung stehen.
  }

  return (
    <form className="df-form" onSubmit={absenden}>
      <label className="feld">
        <span className="feld-label">Datum</span>
        <input type="date" value={datum} onChange={(e) => setDatum(e.target.value)} />
      </label>
      <label className="feld">
        <span className="feld-label">Drohnensteuerer</span>
        <input
          type="text"
          value={drohnensteuerer}
          onChange={(e) => setDrohnensteuerer(e.target.value)}
          autoComplete="off"
        />
      </label>
      <label className="feld">
        <span className="feld-label">Luftraumbeobachter</span>
        <input
          type="text"
          value={luftraumbeobachter}
          onChange={(e) => setLuftraumbeobachter(e.target.value)}
          autoComplete="off"
        />
      </label>
      <button type="submit" className="btn-primaer">
        Durchführung hinzufügen
      </button>
    </form>
  );
}
