import { useState, type FormEvent } from 'react';
import type { Durchfuehrung } from '../domain/progress';

type Props = {
  onAdd: (eintrag: Omit<Durchfuehrung, 'id'>) => void;
  heute: string;
};

export function DurchfuehrungForm({ onAdd, heute }: Props) {
  const [datum, setDatum] = useState(heute);
  const [drohnensteuerer, setDrohnensteuerer] = useState('');
  const [luftraumbeobachter, setLuftraumbeobachter] = useState('');

  function absenden(e: FormEvent) {
    e.preventDefault();
    onAdd({ datum, drohnensteuerer, luftraumbeobachter });
    setDrohnensteuerer('');
    setLuftraumbeobachter('');
    setDatum(heute);
  }

  return (
    <form className="df-form" onSubmit={absenden}>
      <label>
        Datum
        <input type="date" value={datum} onChange={(e) => setDatum(e.target.value)} />
      </label>
      <label>
        Drohnensteuerer
        <input
          type="text"
          value={drohnensteuerer}
          onChange={(e) => setDrohnensteuerer(e.target.value)}
          autoComplete="off"
        />
      </label>
      <label>
        Luftraumbeobachter
        <input
          type="text"
          value={luftraumbeobachter}
          onChange={(e) => setLuftraumbeobachter(e.target.value)}
          autoComplete="off"
        />
      </label>
      <button type="submit">Durchführung hinzufügen</button>
    </form>
  );
}
