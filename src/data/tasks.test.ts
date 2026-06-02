import { describe, it, expect } from 'vitest';
import { AUFGABEN } from './tasks';

describe('AUFGABEN', () => {
  it('enthält genau 24 Aufgaben', () => {
    expect(AUFGABEN).toHaveLength(24);
  });

  it('hat eindeutige IDs', () => {
    const ids = AUFGABEN.map((a) => a.id);
    expect(new Set(ids).size).toBe(24);
  });

  it('verteilt sich korrekt auf die drei Teile (9/10/5)', () => {
    const proTeil = (t: 1 | 2 | 3) => AUFGABEN.filter((a) => a.teil === t).length;
    expect([proTeil(1), proTeil(2), proTeil(3)]).toEqual([9, 10, 5]);
  });

  it('jede Aufgabe hat Titel, mindestens 1 Schritt und zielanzahlDefault >= 1', () => {
    for (const a of AUFGABEN) {
      expect(a.titel.length).toBeGreaterThan(0);
      expect(a.schritte.length).toBeGreaterThan(0);
      expect(a.zielanzahlDefault).toBeGreaterThanOrEqual(1);
    }
  });
});
