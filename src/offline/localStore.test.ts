import { describe, it, expect, beforeEach } from 'vitest';
import { localStore } from './localStore';
import type { ProgressSnapshot } from '../../shared/types';

beforeEach(() => localStorage.clear());

describe('localStore Katalog', () => {
  it('fällt ohne Cache auf den Offline-Katalog aus src/data/tasks.ts zurück', () => {
    expect(localStore.tasksLesen()).toBeNull();
    const katalog = localStore.katalog();
    expect(katalog.length).toBeGreaterThan(0);
    expect(katalog[0]).toHaveProperty('id', '1-1');
    expect(katalog[0]).toHaveProperty('aktiv', true);
  });

  it('liefert gecachten Katalog vorrangig', () => {
    localStore.tasksSchreiben([
      {
        id: 'x-1',
        teil: 1,
        nummer: '9.9',
        titel: 'Test',
        lernziel: '',
        schritte: [],
        durchfuehrungshinweise: [],
        sicherheitshinweise: [],
        zielanzahlDefault: 2,
        sortOrder: 0,
        aktiv: true,
      },
    ]);
    expect(localStore.katalog()).toHaveLength(1);
    expect(localStore.katalog()[0].id).toBe('x-1');
  });
});

describe('localStore Mutations-Queue', () => {
  it('coalesced Execution-Upserts nach id (jüngster gewinnt)', () => {
    localStore.queueAnfuegen({
      art: 'execution',
      daten: { id: 'e1', taskId: '1-1', datum: '2026-06-02', drohnensteuerer: 'A', luftraumbeobachter: '', deletedAt: null },
    });
    localStore.queueAnfuegen({
      art: 'execution',
      daten: { id: 'e1', taskId: '1-1', datum: '2026-06-02', drohnensteuerer: 'A', luftraumbeobachter: '', deletedAt: '2026-06-03T00:00:00Z' },
    });
    const queue = localStore.queueLesen();
    expect(queue).toHaveLength(1);
    expect(queue[0].art).toBe('execution');
    expect(queue[0].daten).toHaveProperty('deletedAt', '2026-06-03T00:00:00Z');
  });

  it('coalesced TaskStatus nach taskId per updatedAt (last-write-wins)', () => {
    localStore.queueAnfuegen({
      art: 'taskStatus',
      daten: { taskId: '1-1', zielanzahl: 3, nichtAnwendbar: false, updatedAt: '2026-06-02T10:00:00Z' },
    });
    localStore.queueAnfuegen({
      art: 'taskStatus',
      daten: { taskId: '1-1', zielanzahl: 5, nichtAnwendbar: false, updatedAt: '2026-06-02T11:00:00Z' },
    });
    // älterer updatedAt darf NICHT gewinnen
    localStore.queueAnfuegen({
      art: 'taskStatus',
      daten: { taskId: '1-1', zielanzahl: 1, nichtAnwendbar: true, updatedAt: '2026-06-02T09:00:00Z' },
    });
    const queue = localStore.queueLesen();
    expect(queue).toHaveLength(1);
    expect(queue[0].daten).toMatchObject({ zielanzahl: 5 });
  });

  it('trennt Queue in executions/taskStatus für /api/sync', () => {
    localStore.queueAnfuegen({
      art: 'execution',
      daten: { id: 'e1', taskId: '1-1', datum: '2026-06-02', drohnensteuerer: '', luftraumbeobachter: '', deletedAt: null },
    });
    localStore.queueAnfuegen({
      art: 'taskStatus',
      daten: { taskId: '1-2', zielanzahl: null, nichtAnwendbar: true, updatedAt: '2026-06-02T10:00:00Z' },
    });
    const { executions, taskStatus } = localStore.queueAlsSyncMutationen();
    expect(executions).toHaveLength(1);
    expect(taskStatus).toHaveLength(1);
    localStore.queueLeeren();
    expect(localStore.queueLesen()).toHaveLength(0);
  });

  it('speichert und liest lastSync', () => {
    expect(localStore.lastSyncLesen()).toBeNull();
    localStore.lastSyncSchreiben('2026-06-02T12:00:00Z');
    expect(localStore.lastSyncLesen()).toBe('2026-06-02T12:00:00Z');
  });
});

describe('localStore Reconciliation (snapshotAnwenden)', () => {
  it('baut Fortschritt autoritativ aus dem Snapshot auf (Tombstones ignoriert)', () => {
    const snapshot: ProgressSnapshot = {
      executions: [
        { id: 'e1', taskId: '1-1', datum: '2026-06-02', drohnensteuerer: 'A', luftraumbeobachter: 'B', deletedAt: null },
        { id: 'e2', taskId: '1-1', datum: '2026-06-03', drohnensteuerer: '', luftraumbeobachter: '', deletedAt: '2026-06-04T00:00:00Z' },
      ],
      taskStatus: [
        { taskId: '1-1', zielanzahl: 2, nichtAnwendbar: false, updatedAt: '2026-06-02T10:00:00Z' },
        { taskId: '1-2', zielanzahl: null, nichtAnwendbar: true, updatedAt: '2026-06-02T10:00:00Z' },
      ],
      serverTime: '2026-06-04T12:00:00Z',
    };
    const state = localStore.snapshotAnwenden(snapshot);
    expect(state.fortschritt['1-1'].durchfuehrungen).toHaveLength(1); // Tombstone raus
    expect(state.fortschritt['1-1'].durchfuehrungen[0].id).toBe('e1');
    expect(state.fortschritt['1-1'].zielanzahl).toBe(2); // Status-Override
    expect(state.fortschritt['1-2'].nichtAnwendbar).toBe(true);
    // persistiert
    expect(localStore.fortschrittLesen()['1-1'].durchfuehrungen).toHaveLength(1);
  });

  it('benachrichtigt Abonnenten beim Schreiben des Fortschritts', () => {
    let benachrichtigt = 0;
    const unsub = localStore.fortschrittAbonnieren(() => {
      benachrichtigt += 1;
    });
    localStore.snapshotAnwenden({ executions: [], taskStatus: [], serverTime: '2026-06-02T00:00:00Z' });
    expect(benachrichtigt).toBe(1);
    unsub();
    localStore.snapshotAnwenden({ executions: [], taskStatus: [], serverTime: '2026-06-03T00:00:00Z' });
    expect(benachrichtigt).toBe(1); // nach unsub keine weitere Benachrichtigung
  });
});
