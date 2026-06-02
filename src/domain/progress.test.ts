import { describe, it, expect } from 'vitest';
import {
  type AufgabenFortschritt,
  leererFortschritt,
  aufgabenStatus,
  aufgabenQuote,
  gesamtFortschritt,
} from './progress';

const mit = (over: Partial<AufgabenFortschritt>): AufgabenFortschritt => ({
  ...leererFortschritt(3),
  ...over,
});

const durchfuehrungen = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: String(i),
    datum: '2026-06-02',
    drohnensteuerer: '',
    luftraumbeobachter: '',
  }));

describe('aufgabenStatus', () => {
  it('ist "offen" ohne Durchführungen', () => {
    expect(aufgabenStatus(mit({}))).toBe('offen');
  });
  it('ist "erledigt", wenn Zielanzahl erreicht', () => {
    expect(aufgabenStatus(mit({ durchfuehrungen: durchfuehrungen(3) }))).toBe('erledigt');
  });
  it('ist "offen", wenn Zielanzahl noch nicht erreicht', () => {
    expect(aufgabenStatus(mit({ durchfuehrungen: durchfuehrungen(2) }))).toBe('offen');
  });
  it('ist "nicht-anwendbar", unabhängig von Durchführungen', () => {
    expect(
      aufgabenStatus(mit({ nichtAnwendbar: true, durchfuehrungen: durchfuehrungen(5) })),
    ).toBe('nicht-anwendbar');
  });
});

describe('aufgabenQuote', () => {
  it('begrenzt auf 1 (kein Überlauf)', () => {
    expect(aufgabenQuote(mit({ durchfuehrungen: durchfuehrungen(5) }))).toBe(1);
  });
  it('rechnet anteilig', () => {
    expect(aufgabenQuote(mit({ durchfuehrungen: durchfuehrungen(1) }))).toBeCloseTo(1 / 3);
  });
});

describe('gesamtFortschritt', () => {
  it('zählt erledigte und ignoriert nicht-anwendbare im Nenner', () => {
    const map = {
      a: mit({ durchfuehrungen: durchfuehrungen(3) }),
      b: mit({}),
      c: mit({ nichtAnwendbar: true }),
    };
    expect(gesamtFortschritt(map)).toEqual({ erledigt: 1, gesamt: 2 });
  });
});
