import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { SyncRequest, SyncResponse } from '../../shared/types';

// Gemockter API-Client: nur api.sync wird von der syncEngine genutzt.
const syncMock = vi.fn<(req: SyncRequest) => Promise<SyncResponse>>();
vi.mock('../api/client', () => {
  class ApiError extends Error {
    status: number;
    code: string;
    constructor(status: number, code: string, message: string) {
      super(message);
      this.status = status;
      this.code = code;
    }
  }
  return { api: { sync: (req: SyncRequest) => syncMock(req) }, ApiError };
});

// Nach dem Mock importieren, damit die Engine den Mock erhält.
const { localStore } = await import('./localStore');
const { syncEngine } = await import('./syncEngine');
const { ApiError } = await import('../api/client');

beforeEach(() => {
  localStorage.clear();
  syncMock.mockReset();
});

describe('syncEngine Reconciliation', () => {
  it('pusht die Queue, wendet den Snapshot autoritativ an, leert die Queue und setzt lastSync', async () => {
    localStore.queueAnfuegen({
      art: 'execution',
      daten: { id: 'e1', taskId: '1-1', datum: '2026-06-02', drohnensteuerer: 'A', luftraumbeobachter: '', deletedAt: null },
    });
    localStore.lastSyncSchreiben('2026-06-01T00:00:00Z');

    syncMock.mockResolvedValueOnce({
      executions: [
        { id: 'e1', taskId: '1-1', datum: '2026-06-02', drohnensteuerer: 'A', luftraumbeobachter: '', deletedAt: null },
      ],
      taskStatus: [{ taskId: '1-1', zielanzahl: 1, nichtAnwendbar: false, updatedAt: '2026-06-02T10:00:00Z' }],
      serverTime: '2026-06-02T12:00:00Z',
    });

    await syncEngine.syncJetzt();

    // Request enthielt since + Queue-Mutationen
    expect(syncMock).toHaveBeenCalledTimes(1);
    const req = syncMock.mock.calls[0][0];
    expect(req.since).toBe('2026-06-01T00:00:00Z');
    expect(req.executions).toHaveLength(1);

    // Reconciliation: Fortschritt aus Snapshot
    expect(localStore.fortschrittLesen()['1-1'].durchfuehrungen).toHaveLength(1);
    expect(localStore.fortschrittLesen()['1-1'].zielanzahl).toBe(1);

    // Queue geleert, lastSync gesetzt, Status 'synced'
    expect(localStore.queueLesen()).toHaveLength(0);
    expect(localStore.lastSyncLesen()).toBe('2026-06-02T12:00:00Z');
    expect(syncEngine.statusLesen()).toBe('synced');
  });

  it('behält bei Netzfehler die Queue und setzt Status', async () => {
    localStore.queueAnfuegen({
      art: 'taskStatus',
      daten: { taskId: '1-1', zielanzahl: 3, nichtAnwendbar: false, updatedAt: '2026-06-02T10:00:00Z' },
    });
    syncMock.mockRejectedValueOnce(new ApiError(0, 'network_error', 'offline'));

    await syncEngine.syncJetzt();

    expect(localStore.queueLesen()).toHaveLength(1); // Queue bleibt
    expect(localStore.lastSyncLesen()).toBeNull();
    expect(syncEngine.statusLesen()).toBe('offline');
  });

  it('Idempotenz: zweimaliger Sync mit gleicher Queue erzeugt keine Doppel-Push-Effekte lokal', async () => {
    localStore.queueAnfuegen({
      art: 'execution',
      daten: { id: 'e1', taskId: '1-1', datum: '2026-06-02', drohnensteuerer: '', luftraumbeobachter: '', deletedAt: null },
    });
    const antwort: SyncResponse = {
      executions: [
        { id: 'e1', taskId: '1-1', datum: '2026-06-02', drohnensteuerer: '', luftraumbeobachter: '', deletedAt: null },
      ],
      taskStatus: [],
      serverTime: '2026-06-02T12:00:00Z',
    };
    syncMock.mockResolvedValue(antwort);

    await syncEngine.syncJetzt();
    expect(localStore.queueLesen()).toHaveLength(0);
    // zweiter Lauf: Queue ist leer, Snapshot bleibt konsistent
    await syncEngine.syncJetzt();
    expect(localStore.fortschrittLesen()['1-1'].durchfuehrungen).toHaveLength(1);
  });

  it('behält Mutationen, die WÄHREND eines laufenden Syncs neu angefügt werden (§9)', async () => {
    // Eintrag A wird gepusht.
    localStore.queueAnfuegen({
      art: 'execution',
      daten: { id: 'A', taskId: '1-1', datum: '2026-06-02', drohnensteuerer: '', luftraumbeobachter: '', deletedAt: null },
    });

    // Sync hängt, bis wir auflösen — währenddessen kommt Eintrag B hinzu.
    let aufloesen!: (r: SyncResponse) => void;
    syncMock.mockImplementationOnce(
      () => new Promise<SyncResponse>((res) => { aufloesen = res; }),
    );
    const lauf = syncEngine.syncJetzt();

    // B während des In-Flight-Syncs anfügen.
    localStore.queueAnfuegen({
      art: 'execution',
      daten: { id: 'B', taskId: '1-2', datum: '2026-06-02', drohnensteuerer: '', luftraumbeobachter: '', deletedAt: null },
    });

    aufloesen({
      executions: [
        { id: 'A', taskId: '1-1', datum: '2026-06-02', drohnensteuerer: '', luftraumbeobachter: '', deletedAt: null },
      ],
      taskStatus: [],
      serverTime: '2026-06-02T12:00:00Z',
    });
    await lauf;

    // A wurde bestätigt und entfernt, B bleibt für den nächsten Sync erhalten.
    const queue = localStore.queueLesen();
    expect(queue).toHaveLength(1);
    expect(queue[0].daten).toHaveProperty('id', 'B');

    // §9-Merge: B (während des Syncs lokal angelegt, im Snapshot noch NICHT
    // enthalten) muss im Fortschritt sichtbar bleiben, nicht kurz verschwinden.
    const fortschritt = localStore.fortschrittLesen();
    expect(fortschritt['1-2'].durchfuehrungen).toHaveLength(1);
    expect(fortschritt['1-2'].durchfuehrungen[0].id).toBe('B');
    // A bleibt aus dem Snapshot erhalten.
    expect(fortschritt['1-1'].durchfuehrungen.map((d) => d.id)).toEqual(['A']);
  });

  it('Merge: ein während des Syncs gelöschter Eintrag (Tombstone) gewinnt über den Snapshot', async () => {
    // Server-Snapshot enthält e1 als aktiv; lokal kommt während des Syncs ein
    // Tombstone für e1 hinzu — der Eintrag darf danach NICHT mehr im Fortschritt sein.
    localStore.queueAnfuegen({
      art: 'execution',
      daten: { id: 'e1', taskId: '1-1', datum: '2026-06-02', drohnensteuerer: '', luftraumbeobachter: '', deletedAt: null },
    });

    let aufloesen!: (r: SyncResponse) => void;
    syncMock.mockImplementationOnce(
      () => new Promise<SyncResponse>((res) => { aufloesen = res; }),
    );
    const lauf = syncEngine.syncJetzt();

    // Während in-flight: e1 lokal löschen (Tombstone, jüngerer Coalesce-Eintrag).
    localStore.queueAnfuegen({
      art: 'execution',
      daten: { id: 'e1', taskId: '1-1', datum: '2026-06-02', drohnensteuerer: '', luftraumbeobachter: '', deletedAt: '2026-06-02T11:00:00Z' },
    });

    aufloesen({
      executions: [
        { id: 'e1', taskId: '1-1', datum: '2026-06-02', drohnensteuerer: '', luftraumbeobachter: '', deletedAt: null },
      ],
      taskStatus: [],
      serverTime: '2026-06-02T12:00:00Z',
    });
    await lauf;

    expect(localStore.fortschrittLesen()['1-1'].durchfuehrungen).toHaveLength(0);
  });

  it('debounce: mutationGemeldet löst nach Ablauf genau einen Sync aus', async () => {
    vi.useFakeTimers();
    syncMock.mockResolvedValue({ executions: [], taskStatus: [], serverTime: '2026-06-02T12:00:00Z' });
    try {
      syncEngine.mutationGemeldet();
      syncEngine.mutationGemeldet(); // mehrfach → ein Sync
      expect(syncMock).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(2100);
      expect(syncMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
