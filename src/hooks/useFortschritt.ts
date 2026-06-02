import { useCallback, useEffect, useRef } from 'react';
import { AUFGABEN } from '../data/tasks';
import { useAuthOptional } from '../auth/AuthContext';
import {
  type AufgabenFortschritt,
  type Durchfuehrung,
  leererFortschritt,
} from '../domain/progress';
import { localStore } from '../offline/localStore';
import { syncEngine } from '../offline/syncEngine';
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

function jetztIso(): string {
  return new Date().toISOString();
}

// Stabiler Epoch-Zeitstempel für die einmalige Übernahme anonymer TaskStatus.
// Begründung (§9, last-write-wins): Der Server wendet TaskStatus strikt per
// `excluded.updated_at > task_status.updated_at` an und fügt nur dann ein neues
// Status-Row ein, wenn noch keines existiert. Mit einem Epoch-Stempel verliert
// die Übernahme JEDEN Konflikt gegen einen vorhandenen Server-Wert (= kein
// stilles Überschreiben von Werten anderer Geräte), füllt aber Lücken auf einem
// frischen Server-Konto. Echte spätere Änderungen tragen `jetztIso()` und
// schlagen den Epoch-Stempel zuverlässig (selbstkorrigierend).
const EPOCH_ISO = '1970-01-01T00:00:00.000Z';

// Default-Zielanzahl je Aufgabe aus dem Katalog (zum Erkennen echter Abweichungen).
const ZIEL_DEFAULTS: Record<string, number> = Object.fromEntries(
  AUFGABEN.map((a) => [a.id, Math.max(1, a.zielanzahlDefault)]),
);

// Weicht der lokale TaskStatus vom Katalog-Default ab? Nur dann lohnt die Übernahme.
function statusWeichtAb(taskId: string, f: AufgabenFortschritt): boolean {
  return f.nichtAnwendbar || f.zielanzahl !== (ZIEL_DEFAULTS[taskId] ?? 1);
}

export function useFortschritt() {
  const [state, setState, speicherfehler] = useLocalStorage<AppState>(STORAGE_KEY, initialerState());
  // Nur ältere Stände migrieren; einen unbekannten höheren Schema-Stand defensiv NICHT überschreiben.
  const sicher = state.schemaVersion < SCHEMA_VERSION ? migrieren(state) : state;

  // Optionaler Auth-Kontext: ohne Provider (z. B. in bestehenden Tests) ist das
  // `null` → rein lokaler Modus, kein Sync. Mit eingeloggtem Teilnehmer werden
  // Schreibvorgänge zusätzlich in die Sync-Queue gespiegelt.
  const auth = useAuthOptional();
  const eingeloggterTeilnehmer = auth?.identity.kind === 'participant';

  // Aktuellen Stand für Event-Handler/Effekte ohne Stale-Closure halten.
  // (Aktualisierung im Effekt, nicht während des Renderns.)
  const stateRef = useRef(sicher);
  useEffect(() => {
    stateRef.current = sicher;
  }, [sicher]);

  // Server-Pull/Reconciliation (syncEngine schreibt den Fortschritt über den
  // localStore und benachrichtigt hier) → erneut lesen und neu rendern.
  useEffect(() => {
    return localStore.fortschrittAbonnieren((neu) => {
      setState(neu as AppState);
    });
  }, [setState]);

  // Anonym → eingeloggt: lokalen Fortschritt einmalig in die Queue übernehmen
  // und hochladen (Merge mit Server). Pro Teilnehmer genau einmal — der Marker
  // liegt persistent im localStore, damit Reloads/Mounts den Stand nicht erneut
  // hochladen (§9).
  //
  // Wichtig gegen Datenverlust geräteübergreifend:
  //  - Executions sind additiv/idempotent (PK = client-UUID) → unbedenklich,
  //    werden immer übernommen.
  //  - TaskStatus wird NUR übernommen, wenn er vom Katalog-Default abweicht
  //    (sonst kein echter Anon-Eintrag), und mit EPOCH-Zeitstempel: so verliert
  //    er jeden Konflikt gegen einen vorhandenen Server-Wert (kein stilles
  //    Überschreiben), füllt aber Lücken eines frischen Server-Kontos.
  useEffect(() => {
    if (auth?.identity.kind !== 'participant') return;
    const teilnehmerId = auth.identity.id;
    if (localStore.uebernommenGesetzt(teilnehmerId)) return;
    localStore.uebernommenMarkieren(teilnehmerId);

    const aktuell = stateRef.current.fortschritt;
    for (const [taskId, f] of Object.entries(aktuell)) {
      for (const d of f.durchfuehrungen) {
        localStore.queueAnfuegen({
          art: 'execution',
          daten: {
            id: d.id,
            taskId,
            datum: d.datum,
            drohnensteuerer: d.drohnensteuerer,
            luftraumbeobachter: d.luftraumbeobachter,
            deletedAt: null,
          },
        });
      }
      if (statusWeichtAb(taskId, f)) {
        localStore.queueAnfuegen({
          art: 'taskStatus',
          daten: {
            taskId,
            zielanzahl: f.zielanzahl,
            nichtAnwendbar: f.nichtAnwendbar,
            updatedAt: EPOCH_ISO,
          },
        });
      }
    }
    syncEngine.mutationGemeldet();
  }, [auth?.identity]);

  // Spiegelt eine Execution-Mutation (Upsert/Tombstone) in die Queue + triggert Sync.
  const execMutation = useCallback(
    (taskId: string, d: Durchfuehrung, geloescht: boolean) => {
      if (!eingeloggterTeilnehmer) return;
      localStore.queueAnfuegen({
        art: 'execution',
        daten: {
          id: d.id,
          taskId,
          datum: d.datum,
          drohnensteuerer: d.drohnensteuerer,
          luftraumbeobachter: d.luftraumbeobachter,
          deletedAt: geloescht ? jetztIso() : null,
        },
      });
      syncEngine.mutationGemeldet();
    },
    [eingeloggterTeilnehmer],
  );

  // Spiegelt eine TaskStatus-Mutation (Zielanzahl/nicht-anwendbar) in die Queue.
  const statusMutation = useCallback(
    (taskId: string, f: AufgabenFortschritt) => {
      if (!eingeloggterTeilnehmer) return;
      localStore.queueAnfuegen({
        art: 'taskStatus',
        daten: {
          taskId,
          zielanzahl: f.zielanzahl,
          nichtAnwendbar: f.nichtAnwendbar,
          updatedAt: jetztIso(),
        },
      });
      syncEngine.mutationGemeldet();
    },
    [eingeloggterTeilnehmer],
  );

  const aendern = useCallback(
    (id: string, fn: (f: AufgabenFortschritt) => AufgabenFortschritt) => {
      const vorher = stateRef.current.fortschritt[id];
      if (!vorher) return vorher;
      const nachher = fn(vorher);
      setState({
        ...stateRef.current,
        fortschritt: { ...stateRef.current.fortschritt, [id]: nachher },
      });
      return nachher;
    },
    [setState],
  );

  const durchfuehrungHinzufuegen = useCallback(
    (id: string, eintrag: Omit<Durchfuehrung, 'id'>) => {
      const neu: Durchfuehrung = { ...eintrag, id: neueId() };
      aendern(id, (f) => ({ ...f, durchfuehrungen: [...f.durchfuehrungen, neu] }));
      execMutation(id, neu, false);
    },
    [aendern, execMutation],
  );

  const durchfuehrungEntfernen = useCallback(
    (id: string, eintragId: string) => {
      // Eintrag vor dem Entfernen erfassen, um Tombstone (mit Original-ID) zu bilden.
      const entfernt = stateRef.current.fortschritt[id]?.durchfuehrungen.find(
        (d) => d.id === eintragId,
      );
      aendern(id, (f) => ({
        ...f,
        durchfuehrungen: f.durchfuehrungen.filter((d) => d.id !== eintragId),
      }));
      if (entfernt) execMutation(id, entfernt, true);
    },
    [aendern, execMutation],
  );

  const zielanzahlSetzen = useCallback(
    (id: string, ziel: number) => {
      const nachher = aendern(id, (f) => ({
        ...f,
        zielanzahl: Math.max(1, Math.floor(ziel) || 1),
      }));
      if (nachher) statusMutation(id, nachher);
    },
    [aendern, statusMutation],
  );

  const nichtAnwendbarSetzen = useCallback(
    (id: string, wert: boolean) => {
      const nachher = aendern(id, (f) => ({ ...f, nichtAnwendbar: wert }));
      if (nachher) statusMutation(id, nachher);
    },
    [aendern, statusMutation],
  );

  return {
    speicherfehler,
    fortschritt: sicher.fortschritt,
    durchfuehrungHinzufuegen,
    durchfuehrungEntfernen,
    zielanzahlSetzen,
    nichtAnwendbarSetzen,
  };
}
