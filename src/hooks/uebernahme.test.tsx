import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { Identity, TaskDTO } from '../../shared/types';

// api.me() liefert eine Teilnehmer-Identität → AuthProvider wechselt von anon zu
// participant und löst die einmalige Übernahme in useFortschritt aus.
// (Identität in der Factory definiert; vi.mock wird an den Dateianfang gehoist.)
vi.mock('../api/client', () => {
  const participant: Identity = {
    kind: 'participant',
    id: 'p-1',
    name: 'Test',
  };
  return {
    ApiError: class ApiError extends Error {},
    api: {
      me: vi.fn().mockResolvedValue(participant),
      participantLogin: vi.fn(),
      logout: vi.fn(),
      sync: vi.fn(),
    },
  };
});

// syncEngine nicht real triggern (kein Netz/Timer in diesem Test).
vi.mock('../offline/syncEngine', () => ({
  syncEngine: { mutationGemeldet: vi.fn() },
}));

import { AuthProvider } from '../auth/AuthContext';
import { localStore } from '../offline/localStore';
import { useFortschritt } from './useFortschritt';

const EPOCH_ISO = '1970-01-01T00:00:00.000Z';

// Minimaler Katalog mit den Default-Zielanzahlen, auf denen die Abweichungs-
// Heuristik (statusWeichtAb) beruht: 1-1 → 4, 1-2 → 8.
function task(id: string, nummer: string, zielanzahlDefault: number): TaskDTO {
  return {
    id,
    teil: 1,
    nummer,
    titel: id,
    lernziel: '',
    schritte: [],
    durchfuehrungshinweise: [],
    sicherheitshinweise: [],
    zielanzahlDefault,
    sortOrder: 0,
    aktiv: true,
    bildUrl: null,
  };
}
const KATALOG: TaskDTO[] = [task('1-1', '1.1', 4), task('1-2', '1.2', 8)];

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

beforeEach(() => localStorage.clear());

describe('useFortschritt — Anonym → eingeloggt Übernahme (§9)', () => {
  it('übernimmt nur abweichende TaskStatus (mit Epoch) + alle Executions, genau einmal', async () => {
    // Anonymer Vorzustand: 1-1 hat eine abweichende Zielanzahl + eine Durchführung,
    // 1-2 bleibt auf dem Katalog-Default (darf NICHT als TaskStatus übernommen werden).
    localStorage.setItem(
      'drk-drohnen-fortschritt',
      JSON.stringify({
        schemaVersion: 1,
        fortschritt: {
          '1-1': {
            zielanzahl: 9, // weicht vom Default (4) ab
            durchfuehrungen: [
              { id: 'exec-1', datum: '2026-06-01', drohnensteuerer: 'A', luftraumbeobachter: 'B' },
            ],
            nichtAnwendbar: false,
          },
          '1-2': { zielanzahl: 8, durchfuehrungen: [], nichtAnwendbar: false }, // 8 = Default → kein Status
        },
      }),
    );

    const { unmount } = renderHook(() => useFortschritt(KATALOG), { wrapper });

    await waitFor(() => {
      const { taskStatus } = localStore.queueAlsSyncMutationen();
      expect(taskStatus.length).toBeGreaterThan(0);
    });

    const { executions, taskStatus } = localStore.queueAlsSyncMutationen();

    // Nur die abweichende Aufgabe wird als TaskStatus übernommen, mit Epoch-Stempel.
    expect(taskStatus).toHaveLength(1);
    expect(taskStatus[0]).toMatchObject({ taskId: '1-1', zielanzahl: 9, updatedAt: EPOCH_ISO });

    // Executions werden additiv/idempotent übernommen.
    expect(executions).toHaveLength(1);
    expect(executions[0]).toMatchObject({ id: 'exec-1', taskId: '1-1', deletedAt: null });

    // Persistenter Marker gesetzt → ein zweiter Mount darf NICHT erneut übernehmen.
    expect(localStore.uebernommenGesetzt('p-1')).toBe(true);
    act(() => unmount());
    localStore.queueLeeren();

    renderHook(() => useFortschritt(KATALOG), { wrapper });
    // Kurz warten, falls der Effekt doch feuern würde.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(localStore.queueAlsSyncMutationen().taskStatus).toHaveLength(0);
    expect(localStore.queueAlsSyncMutationen().executions).toHaveLength(0);
  });
});
