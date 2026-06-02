import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFortschritt } from './useFortschritt';

beforeEach(() => localStorage.clear());

describe('useFortschritt', () => {
  it('initialisiert jede Aufgabe mit ihrer Default-Zielanzahl', () => {
    const { result } = renderHook(() => useFortschritt());
    expect(result.current.fortschritt['1-1'].zielanzahl).toBe(4);
    expect(result.current.fortschritt['1-1'].durchfuehrungen).toEqual([]);
  });

  it('fügt eine Durchführung hinzu', () => {
    const { result } = renderHook(() => useFortschritt());
    act(() =>
      result.current.durchfuehrungHinzufuegen('1-1', {
        datum: '2026-06-02',
        drohnensteuerer: 'A',
        luftraumbeobachter: 'B',
      }),
    );
    expect(result.current.fortschritt['1-1'].durchfuehrungen).toHaveLength(1);
    expect(result.current.fortschritt['1-1'].durchfuehrungen[0].id).toBeTruthy();
  });

  it('entfernt eine Durchführung', () => {
    const { result } = renderHook(() => useFortschritt());
    act(() =>
      result.current.durchfuehrungHinzufuegen('1-1', {
        datum: '2026-06-02',
        drohnensteuerer: '',
        luftraumbeobachter: '',
      }),
    );
    const id = result.current.fortschritt['1-1'].durchfuehrungen[0].id;
    act(() => result.current.durchfuehrungEntfernen('1-1', id));
    expect(result.current.fortschritt['1-1'].durchfuehrungen).toHaveLength(0);
  });

  it('setzt die Zielanzahl (minimal 1)', () => {
    const { result } = renderHook(() => useFortschritt());
    act(() => result.current.zielanzahlSetzen('1-1', 0));
    expect(result.current.fortschritt['1-1'].zielanzahl).toBe(1);
  });

  it('schaltet nicht-anwendbar um', () => {
    const { result } = renderHook(() => useFortschritt());
    act(() => result.current.nichtAnwendbarSetzen('2-1', true));
    expect(result.current.fortschritt['2-1'].nichtAnwendbar).toBe(true);
  });

  it('mischt neue/fehlende Aufgaben in einen veralteten Stand ein (Migration)', () => {
    localStorage.setItem(
      'drk-drohnen-fortschritt',
      JSON.stringify({
        schemaVersion: 0,
        fortschritt: {
          '1-1': { zielanzahl: 9, durchfuehrungen: [], nichtAnwendbar: false },
        },
      }),
    );
    const { result } = renderHook(() => useFortschritt());
    expect(result.current.fortschritt['1-1'].zielanzahl).toBe(9); // bestehender Stand erhalten
    expect(result.current.fortschritt['2-1']).toBeDefined();      // fehlende Aufgabe nachgemischt
  });

  it('überschreibt einen unbekannten höheren Schema-Stand nicht', () => {
    localStorage.setItem(
      'drk-drohnen-fortschritt',
      JSON.stringify({
        schemaVersion: 99,
        fortschritt: {
          '1-1': { zielanzahl: 7, durchfuehrungen: [], nichtAnwendbar: false },
        },
      }),
    );
    const { result } = renderHook(() => useFortschritt());
    expect(result.current.fortschritt['1-1'].zielanzahl).toBe(7); // unverändert übernommen
  });
});
