import { useCallback } from 'react';
import { AUFGABEN } from '../data/tasks';
import {
  type AufgabenFortschritt,
  type Durchfuehrung,
  leererFortschritt,
} from '../domain/progress';
import { useLocalStorage } from './useLocalStorage';

const STORAGE_KEY = 'drk-drohnen-fortschritt';
const SCHEMA_VERSION = 1;

type AppState = {
  schemaVersion: number;
  fortschritt: Record<string, AufgabenFortschritt>;
};

function initialerState(): AppState {
  const fortschritt: Record<string, AufgabenFortschritt> = {};
  for (const a of AUFGABEN) fortschritt[a.id] = leererFortschritt(a.zielanzahlDefault);
  return { schemaVersion: SCHEMA_VERSION, fortschritt };
}

// Mischt fehlende Aufgaben nach (z. B. nach Inhalts-Update) und respektiert Schema.
function migrieren(state: AppState): AppState {
  const basis = initialerState();
  const gemischt: Record<string, AufgabenFortschritt> = { ...basis.fortschritt };
  for (const a of AUFGABEN) {
    if (state.fortschritt?.[a.id]) gemischt[a.id] = state.fortschritt[a.id];
  }
  return { schemaVersion: SCHEMA_VERSION, fortschritt: gemischt };
}

function neueId(): string {
  return crypto.randomUUID();
}

export function useFortschritt() {
  const [state, setState] = useLocalStorage<AppState>(STORAGE_KEY, initialerState());
  const sicher = state.schemaVersion === SCHEMA_VERSION ? state : migrieren(state);

  const aendern = useCallback(
    (id: string, fn: (f: AufgabenFortschritt) => AufgabenFortschritt) => {
      const vorher = sicher.fortschritt[id];
      if (!vorher) return;
      setState({
        ...sicher,
        fortschritt: { ...sicher.fortschritt, [id]: fn(vorher) },
      });
    },
    [sicher, setState],
  );

  const durchfuehrungHinzufuegen = useCallback(
    (id: string, eintrag: Omit<Durchfuehrung, 'id'>) =>
      aendern(id, (f) => ({
        ...f,
        durchfuehrungen: [...f.durchfuehrungen, { ...eintrag, id: neueId() }],
      })),
    [aendern],
  );

  const durchfuehrungEntfernen = useCallback(
    (id: string, eintragId: string) =>
      aendern(id, (f) => ({
        ...f,
        durchfuehrungen: f.durchfuehrungen.filter((d) => d.id !== eintragId),
      })),
    [aendern],
  );

  const zielanzahlSetzen = useCallback(
    (id: string, ziel: number) =>
      aendern(id, (f) => ({ ...f, zielanzahl: Math.max(1, Math.floor(ziel) || 1) })),
    [aendern],
  );

  const nichtAnwendbarSetzen = useCallback(
    (id: string, wert: boolean) => aendern(id, (f) => ({ ...f, nichtAnwendbar: wert })),
    [aendern],
  );

  return {
    fortschritt: sicher.fortschritt,
    durchfuehrungHinzufuegen,
    durchfuehrungEntfernen,
    zielanzahlSetzen,
    nichtAnwendbarSetzen,
  };
}
