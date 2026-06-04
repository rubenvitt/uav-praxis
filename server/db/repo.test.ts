import '../test/_env.ts';
import { beforeEach, describe, expect, it } from 'vitest';
import { closeDb, getDb } from './client.ts';
import { repo } from './repo.ts';
import type { SyncRequest } from '../../shared/types.ts';
import {
  gesamtFortschritt,
  leererFortschritt,
  type AufgabenFortschritt,
} from '../../src/domain/progress.ts';
import { seed } from './seed.ts';

// Frische In-Memory-DB pro Test.
beforeEach(() => {
  closeDb();
  getDb(); // öffnet ':memory:' und migriert
});

function setupTaskKurzKatalog() {
  // Zwei aktive Tasks mit Default-Zielanzahl 2 und 1, plus ein inaktiver.
  repo.taskAnlegen({
    id: 't1',
    teil: 1,
    nummer: '1.1',
    titel: 'Schwebeflug',
    lernziel: '',
    schritte: [],
    durchfuehrungshinweise: [],
    sicherheitshinweise: [],
    zielanzahlDefault: 2,
    sortOrder: 0,
    aktiv: true,
  });
  repo.taskAnlegen({
    id: 't2',
    teil: 1,
    nummer: '1.2',
    titel: 'Landung',
    lernziel: '',
    schritte: [],
    durchfuehrungshinweise: [],
    sicherheitshinweise: [],
    zielanzahlDefault: 1,
    sortOrder: 1,
    aktiv: true,
  });
  repo.taskAnlegen({
    id: 't3',
    teil: 1,
    nummer: '1.3',
    titel: 'Inaktiv',
    lernziel: '',
    schritte: [],
    durchfuehrungshinweise: [],
    sicherheitshinweise: [],
    zielanzahlDefault: 1,
    sortOrder: 2,
    aktiv: false,
  });
}

function setupTeilnehmer(): { participantId: string } {
  const teilnehmer = repo.teilnehmerAnlegen('Alice');
  return { participantId: teilnehmer.id };
}

describe('Sync-Idempotenz', () => {
  it('wendet denselben SyncRequest zweimal an, ohne Duplikate zu erzeugen', () => {
    setupTaskKurzKatalog();
    const { participantId } = setupTeilnehmer();

    const req: SyncRequest = {
      since: null,
      executions: [
        {
          id: 'exec-1',
          taskId: 't1',
          datum: '2026-06-01',
          drohnensteuerer: 'Alice',
          luftraumbeobachter: 'Bob',
          deletedAt: null,
        },
      ],
      taskStatus: [
        { taskId: 't1', zielanzahl: null, nichtAnwendbar: false, updatedAt: '2026-06-01T10:00:00.000Z' },
      ],
    };

    const erst = repo.sync(participantId, req);
    expect(erst.executions).toHaveLength(1);
    expect(erst.taskStatus).toHaveLength(1);

    const zweit = repo.sync(participantId, req);
    expect(zweit.executions).toHaveLength(1); // keine Duplikate (PK = client-UUID)
    expect(zweit.taskStatus).toHaveLength(1);

    const anzahl = (
      getDb().prepare(`SELECT COUNT(*) AS c FROM executions`).get() as { c: number }
    ).c;
    expect(anzahl).toBe(1);
  });

  it('TaskStatus ist last-write-wins per updatedAt (älteres updatedAt überschreibt nicht)', () => {
    setupTaskKurzKatalog();
    const { participantId } = setupTeilnehmer();

    repo.sync(participantId, {
      since: null,
      executions: [],
      taskStatus: [
        { taskId: 't1', zielanzahl: 5, nichtAnwendbar: false, updatedAt: '2026-06-02T12:00:00.000Z' },
      ],
    });

    // Älteres Update darf nicht gewinnen.
    repo.sync(participantId, {
      since: null,
      executions: [],
      taskStatus: [
        { taskId: 't1', zielanzahl: 99, nichtAnwendbar: true, updatedAt: '2026-06-01T00:00:00.000Z' },
      ],
    });

    const snap = repo.fortschritt(participantId);
    const st = snap.taskStatus.find((s) => s.taskId === 't1');
    expect(st?.zielanzahl).toBe(5);
    expect(st?.nichtAnwendbar).toBe(false);

    // Neueres Update gewinnt.
    repo.sync(participantId, {
      since: null,
      executions: [],
      taskStatus: [
        { taskId: 't1', zielanzahl: 3, nichtAnwendbar: false, updatedAt: '2026-06-03T00:00:00.000Z' },
      ],
    });
    const snap2 = repo.fortschritt(participantId);
    expect(snap2.taskStatus.find((s) => s.taskId === 't1')?.zielanzahl).toBe(3);
  });

  it('Tombstone (deletedAt) wird beim erneuten Upsert übernommen', () => {
    setupTaskKurzKatalog();
    const { participantId } = setupTeilnehmer();

    repo.sync(participantId, {
      since: null,
      executions: [
        { id: 'e1', taskId: 't1', datum: '2026-06-01', drohnensteuerer: '', luftraumbeobachter: '', deletedAt: null },
      ],
      taskStatus: [],
    });
    repo.sync(participantId, {
      since: null,
      executions: [
        { id: 'e1', taskId: 't1', datum: '2026-06-01', drohnensteuerer: '', luftraumbeobachter: '', deletedAt: '2026-06-02T00:00:00.000Z' },
      ],
      taskStatus: [],
    });

    const snap = repo.fortschritt(participantId);
    expect(snap.executions).toHaveLength(1);
    expect(snap.executions[0].deletedAt).toBe('2026-06-02T00:00:00.000Z');
  });
});

describe('Seed', () => {
  it('legt fehlende Tasks an und überschreibt Admin-Bearbeitungen beim erneuten Seed nicht', () => {
    seed();
    const vorher = repo.taskById('1-1');
    expect(vorher).not.toBeNull();

    repo.taskAendern('1-1', { titel: 'Bearbeitet', zielanzahlDefault: 99, sortOrder: 42 });
    seed(); // Neustart simulieren

    const nachher = repo.taskById('1-1');
    expect(nachher?.titel).toBe('Bearbeitet');
    expect(nachher?.zielanzahlDefault).toBe(99);
    expect(nachher?.sortOrder).toBe(42);
  });
});

describe('Code-Login', () => {
  it('akzeptiert gültigen Code und lehnt ungültigen ab', () => {
    const teilnehmer = repo.teilnehmerAnlegen('Carol');

    expect(repo.teilnehmerPerCode(teilnehmer.loginCode)?.id).toBe(teilnehmer.id);
    expect(repo.teilnehmerPerCode('XXXXXXXX')).toBeNull();
  });

  it('lehnt Code eines inaktiven Teilnehmers ab', () => {
    const teilnehmer = repo.teilnehmerAnlegen('Dan');
    repo.teilnehmerAendern(teilnehmer.id, { aktiv: false });
    expect(repo.teilnehmerPerCode(teilnehmer.loginCode)).toBeNull();
  });
});

describe('Progress-Berechnung (spiegelt src/domain/progress.ts)', () => {
  it('zählt erledigt/gesamt korrekt; nichtAnwendbar zählt nicht zu gesamt', () => {
    setupTaskKurzKatalog();
    const { participantId } = setupTeilnehmer();

    // t1: Default-Ziel 2 → erledigt mit 2 Executions.
    // t2: Default-Ziel 1, aber als nichtAnwendbar markiert → nicht in gesamt.
    repo.sync(participantId, {
      since: null,
      executions: [
        { id: 'a', taskId: 't1', datum: '2026-06-01', drohnensteuerer: '', luftraumbeobachter: '', deletedAt: null },
        { id: 'b', taskId: 't1', datum: '2026-06-01', drohnensteuerer: '', luftraumbeobachter: '', deletedAt: null },
        // gelöschte Execution zählt nicht:
        { id: 'c', taskId: 't1', datum: '2026-06-01', drohnensteuerer: '', luftraumbeobachter: '', deletedAt: '2026-06-02T00:00:00.000Z' },
      ],
      taskStatus: [
        { taskId: 't2', zielanzahl: null, nichtAnwendbar: true, updatedAt: '2026-06-01T00:00:00.000Z' },
      ],
    });

    const p = repo.teilnehmerDetail(participantId);
    // gesamt: nur t1 (t2 nichtAnwendbar, t3 inaktiv) → 1
    expect(p.gesamt).toBe(1);
    // erledigt: t1 hat 2 nicht-gelöschte Executions ≥ Ziel 2 → 1
    expect(p.erledigt).toBe(1);
    expect(p.quote).toBe(1);
  });

  it('stimmt mit gesamtFortschritt aus src/domain/progress.ts überein', () => {
    setupTaskKurzKatalog();
    const { participantId } = setupTeilnehmer();

    repo.sync(participantId, {
      since: null,
      executions: [
        { id: 'a', taskId: 't1', datum: '2026-06-01', drohnensteuerer: '', luftraumbeobachter: '', deletedAt: null },
        { id: 'b', taskId: 't1', datum: '2026-06-01', drohnensteuerer: '', luftraumbeobachter: '', deletedAt: null },
        { id: 'd', taskId: 't2', datum: '2026-06-01', drohnensteuerer: '', luftraumbeobachter: '', deletedAt: null },
      ],
      taskStatus: [],
    });

    // Erwartung über die Domänen-Funktion rekonstruieren.
    const map: Record<string, AufgabenFortschritt> = {
      t1: { ...leererFortschritt(2), durchfuehrungen: [{ id: 'a', datum: '2026-06-01', drohnensteuerer: '', luftraumbeobachter: '' }, { id: 'b', datum: '2026-06-01', drohnensteuerer: '', luftraumbeobachter: '' }] },
      t2: { ...leererFortschritt(1), durchfuehrungen: [{ id: 'd', datum: '2026-06-01', drohnensteuerer: '', luftraumbeobachter: '' }] },
    };
    const erwartet = gesamtFortschritt(map);

    const p = repo.teilnehmerDetail(participantId);
    expect(p.erledigt).toBe(erwartet.erledigt);
    expect(p.gesamt).toBe(erwartet.gesamt);
  });

  it('berücksichtigt Zielanzahl-Override aus task_status', () => {
    setupTaskKurzKatalog();
    const { participantId } = setupTeilnehmer();

    // t2 Default-Ziel 1, Override auf 3 → mit 2 Executions noch offen.
    repo.sync(participantId, {
      since: null,
      executions: [
        { id: 'x', taskId: 't2', datum: '2026-06-01', drohnensteuerer: '', luftraumbeobachter: '', deletedAt: null },
        { id: 'y', taskId: 't2', datum: '2026-06-01', drohnensteuerer: '', luftraumbeobachter: '', deletedAt: null },
      ],
      taskStatus: [
        { taskId: 't2', zielanzahl: 3, nichtAnwendbar: false, updatedAt: '2026-06-01T00:00:00.000Z' },
      ],
    });

    const p = repo.teilnehmerDetail(participantId);
    expect(p.gesamt).toBe(2); // t1 + t2
    expect(p.erledigt).toBe(0); // t1: 0/2, t2: 2/3
    expect(p.quote).toBe(0);
  });
});
