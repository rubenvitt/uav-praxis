import { randomUUID } from 'node:crypto';
import type {
  ExecutionDTO,
  ParticipantDetailDTO,
  ParticipantDTO,
  ParticipantProgressDTO,
  ProgressSnapshot,
  SyncRequest,
  TaskDTO,
  TaskProgressDTO,
  TaskStatusDTO,
  Teil,
  TeilStatDTO,
} from '../../shared/types.ts';
import { getDb } from './client.ts';
import { loginCodeErzeugen } from '../auth/codes.ts';

// ── Roh-Zeilen (DB-Spalten) ─────────────────────────────────────────────────

interface TaskRow {
  id: string;
  teil: number;
  nummer: string;
  titel: string;
  lernziel: string;
  schritte: string;
  durchfuehrungshinweise: string;
  sicherheitshinweise: string;
  zielanzahl_default: number;
  sort_order: number;
  aktiv: number;
  bild: string | null;
  updated_at: string;
}

interface ParticipantRow {
  id: string;
  name: string;
  login_code: string;
  aktiv: number;
  beginn: string | null;
  last_seen: string | null;
}

interface ExecutionRow {
  id: string;
  task_id: string;
  datum: string;
  drohnensteuerer: string;
  luftraumbeobachter: string;
  deleted_at: string | null;
}

interface TaskStatusRow {
  task_id: string;
  zielanzahl: number | null;
  nicht_anwendbar: number;
  updated_at: string;
}

// ── JSON-Helfer ─────────────────────────────────────────────────────────────

function parseStringArray(raw: string): string[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

function jsonArray(value: string[] | undefined): string {
  return JSON.stringify(Array.isArray(value) ? value : []);
}

// ── Mapping Row → DTO ───────────────────────────────────────────────────────

function mapTask(r: TaskRow): TaskDTO {
  return {
    id: r.id,
    teil: r.teil as TaskDTO['teil'],
    nummer: r.nummer,
    titel: r.titel,
    lernziel: r.lernziel,
    schritte: parseStringArray(r.schritte),
    durchfuehrungshinweise: parseStringArray(r.durchfuehrungshinweise),
    sicherheitshinweise: parseStringArray(r.sicherheitshinweise),
    zielanzahlDefault: r.zielanzahl_default,
    sortOrder: r.sort_order,
    aktiv: r.aktiv === 1,
    bildUrl: r.bild,
  };
}

function mapParticipant(r: ParticipantRow): ParticipantDTO {
  return {
    id: r.id,
    name: r.name,
    loginCode: r.login_code,
    aktiv: r.aktiv === 1,
    beginn: r.beginn,
    lastSeen: r.last_seen,
  };
}

function mapExecution(r: ExecutionRow): ExecutionDTO {
  return {
    id: r.id,
    taskId: r.task_id,
    datum: r.datum,
    drohnensteuerer: r.drohnensteuerer,
    luftraumbeobachter: r.luftraumbeobachter,
    deletedAt: r.deleted_at,
  };
}

function mapTaskStatus(r: TaskStatusRow): TaskStatusDTO {
  return {
    taskId: r.task_id,
    zielanzahl: r.zielanzahl,
    nichtAnwendbar: r.nicht_anwendbar === 1,
    updatedAt: r.updated_at,
  };
}

const jetzt = () => new Date().toISOString();

// ── Repository ──────────────────────────────────────────────────────────────

export const repo = {
  // ── Tasks (Katalog) ──────────────────────────────────────────────────────

  alleTasks(inklusiveInaktiv = false): TaskDTO[] {
    const db = getDb();
    const sql = inklusiveInaktiv
      ? `SELECT * FROM tasks ORDER BY sort_order, nummer`
      : `SELECT * FROM tasks WHERE aktiv = 1 ORDER BY sort_order, nummer`;
    return (db.prepare(sql).all() as TaskRow[]).map(mapTask);
  },

  taskById(id: string): TaskDTO | null {
    const r = getDb().prepare(`SELECT * FROM tasks WHERE id = ?`).get(id) as
      | TaskRow
      | undefined;
    return r ? mapTask(r) : null;
  },

  taskAnlegen(task: Omit<TaskDTO, 'id' | 'sortOrder'> & { id?: string; sortOrder?: number }): TaskDTO {
    const db = getDb();
    const id = task.id ?? randomUUID();
    const maxSort = (
      db.prepare(`SELECT COALESCE(MAX(sort_order), -1) AS m FROM tasks`).get() as {
        m: number;
      }
    ).m;
    const sortOrder = task.sortOrder ?? maxSort + 1;
    db.prepare(
      `INSERT INTO tasks
        (id, teil, nummer, titel, lernziel, schritte, durchfuehrungshinweise,
         sicherheitshinweise, zielanzahl_default, sort_order, aktiv, bild, updated_at)
       VALUES (@id, @teil, @nummer, @titel, @lernziel, @schritte,
         @durchfuehrungshinweise, @sicherheitshinweise, @zielanzahl_default,
         @sort_order, @aktiv, @bild, @updated_at)`,
    ).run({
      id,
      teil: task.teil,
      nummer: task.nummer,
      titel: task.titel,
      lernziel: task.lernziel ?? '',
      schritte: jsonArray(task.schritte),
      durchfuehrungshinweise: jsonArray(task.durchfuehrungshinweise),
      sicherheitshinweise: jsonArray(task.sicherheitshinweise),
      zielanzahl_default: task.zielanzahlDefault ?? 1,
      sort_order: sortOrder,
      aktiv: task.aktiv === false ? 0 : 1,
      bild: task.bildUrl ?? null,
      updated_at: jetzt(),
    });
    return this.taskById(id)!;
  },

  taskAendern(id: string, patch: Partial<TaskDTO>): TaskDTO {
    const db = getDb();
    const vorhanden = this.taskById(id);
    if (!vorhanden) throw new NotFound('Aufgabe nicht gefunden');
    const next: TaskDTO = {
      ...vorhanden,
      ...patch,
      id,
    };
    db.prepare(
      `UPDATE tasks SET
         teil = @teil, nummer = @nummer, titel = @titel, lernziel = @lernziel,
         schritte = @schritte, durchfuehrungshinweise = @durchfuehrungshinweise,
         sicherheitshinweise = @sicherheitshinweise,
         zielanzahl_default = @zielanzahl_default, sort_order = @sort_order,
         aktiv = @aktiv, bild = @bild, updated_at = @updated_at
       WHERE id = @id`,
    ).run({
      id,
      teil: next.teil,
      nummer: next.nummer,
      titel: next.titel,
      lernziel: next.lernziel ?? '',
      schritte: jsonArray(next.schritte),
      durchfuehrungshinweise: jsonArray(next.durchfuehrungshinweise),
      sicherheitshinweise: jsonArray(next.sicherheitshinweise),
      zielanzahl_default: next.zielanzahlDefault ?? 1,
      sort_order: next.sortOrder ?? 0,
      aktiv: next.aktiv === false ? 0 : 1,
      bild: next.bildUrl ?? null,
      updated_at: jetzt(),
    });
    return this.taskById(id)!;
  },

  taskLoeschen(id: string): void {
    const info = getDb().prepare(`DELETE FROM tasks WHERE id = ?`).run(id);
    if (info.changes === 0) throw new NotFound('Aufgabe nicht gefunden');
  },

  tasksNeuSortieren(ids: string[]): void {
    const db = getDb();
    const stmt = db.prepare(`UPDATE tasks SET sort_order = ?, updated_at = ? WHERE id = ?`);
    const ts = jetzt();
    const tx = db.transaction((liste: string[]) => {
      liste.forEach((id, index) => stmt.run(index, ts, id));
    });
    tx(ids);
  },

  // ── Teilnehmer ───────────────────────────────────────────────────────────

  alleTeilnehmer(): ParticipantDTO[] {
    const rows = getDb()
      .prepare(`SELECT * FROM participants ORDER BY aktiv DESC, name`)
      .all() as ParticipantRow[];
    return rows.map(mapParticipant);
  },

  teilnehmerById(id: string): ParticipantDTO | null {
    const r = getDb()
      .prepare(`SELECT * FROM participants WHERE id = ?`)
      .get(id) as ParticipantRow | undefined;
    return r ? mapParticipant(r) : null;
  },

  teilnehmerAnlegen(name: string, beginn: string | null = null): ParticipantDTO {
    const db = getDb();
    const id = randomUUID();
    const code = this.eindeutigenCodeErzeugen();
    db.prepare(
      `INSERT INTO participants (id, name, login_code, aktiv, beginn, created_at)
       VALUES (?, ?, ?, 1, ?, ?)`,
    ).run(id, name, code, beginn, jetzt());
    return this.teilnehmerById(id)!;
  },

  teilnehmerAendern(
    id: string,
    patch: Partial<ParticipantDTO> & { codeNeu?: boolean },
  ): ParticipantDTO {
    const db = getDb();
    const vorhanden = this.teilnehmerById(id);
    if (!vorhanden) throw new NotFound('Teilnehmer nicht gefunden');
    const loginCode = patch.codeNeu ? this.eindeutigenCodeErzeugen() : vorhanden.loginCode;
    const next = { ...vorhanden, ...patch, loginCode };
    db.prepare(
      `UPDATE participants SET name = @name, aktiv = @aktiv, beginn = @beginn,
         login_code = @login_code
       WHERE id = @id`,
    ).run({
      id,
      name: next.name,
      aktiv: next.aktiv === false ? 0 : 1,
      beginn: next.beginn ?? null,
      login_code: next.loginCode,
    });
    return this.teilnehmerById(id)!;
  },

  teilnehmerLoeschen(id: string): void {
    const info = getDb().prepare(`DELETE FROM participants WHERE id = ?`).run(id);
    if (info.changes === 0) throw new NotFound('Teilnehmer nicht gefunden');
  },

  /** Sucht einen aktiven Teilnehmer per (bereits normalisiertem) Login-Code. */
  teilnehmerPerCode(code: string): ParticipantDTO | null {
    const r = getDb()
      .prepare(`SELECT * FROM participants WHERE login_code = ? AND aktiv = 1`)
      .get(code) as ParticipantRow | undefined;
    return r ? mapParticipant(r) : null;
  },

  /** Setzt last_seen des Teilnehmers auf jetzt. */
  teilnehmerGesehen(id: string): void {
    getDb().prepare(`UPDATE participants SET last_seen = ? WHERE id = ?`).run(jetzt(), id);
  },

  /** Erzeugt einen kollisionsfreien Login-Code (Prüfung gegen DB). */
  eindeutigenCodeErzeugen(): string {
    const db = getDb();
    const exists = db.prepare(`SELECT 1 FROM participants WHERE login_code = ?`);
    for (let i = 0; i < 50; i++) {
      const code = loginCodeErzeugen();
      if (!exists.get(code)) return code;
    }
    throw new Error('Konnte keinen eindeutigen Login-Code erzeugen');
  },

  // ── Admins ───────────────────────────────────────────────────────────────

  /** Legt einen Admin per oidc_sub an oder aktualisiert ihn; liefert die id. */
  adminUpserten(sub: string, email: string | null, name: string | null): string {
    const db = getDb();
    const vorhanden = db
      .prepare(`SELECT id FROM admins WHERE oidc_sub = ?`)
      .get(sub) as { id: string } | undefined;
    const ts = jetzt();
    if (vorhanden) {
      db.prepare(
        `UPDATE admins SET email = ?, name = ?, last_login = ? WHERE id = ?`,
      ).run(email, name, ts, vorhanden.id);
      return vorhanden.id;
    }
    const id = randomUUID();
    db.prepare(
      `INSERT INTO admins (id, oidc_sub, email, name, created_at, last_login)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(id, sub, email, name, ts, ts);
    return id;
  },

  // ── Fortschritt / Sync ───────────────────────────────────────────────────

  fortschritt(participantId: string): ProgressSnapshot {
    const db = getDb();
    const executions = (
      db
        .prepare(`SELECT * FROM executions WHERE participant_id = ?`)
        .all(participantId) as ExecutionRow[]
    ).map(mapExecution);
    const taskStatus = (
      db
        .prepare(`SELECT * FROM task_status WHERE participant_id = ?`)
        .all(participantId) as TaskStatusRow[]
    ).map(mapTaskStatus);
    return { executions, taskStatus, serverTime: jetzt() };
  },

  /**
   * Wendet die Mutationen idempotent an (Execution-PK = client-UUID;
   * Tombstones via deletedAt; TaskStatus last-write-wins per updatedAt) und
   * liefert den autoritativen Snapshot. participantId stammt IMMER aus der
   * Session, nie aus dem Request-Body.
   */
  sync(participantId: string, req: SyncRequest): ProgressSnapshot {
    const db = getDb();

    const execStmt = db.prepare(
      `INSERT INTO executions
         (id, participant_id, task_id, datum, drohnensteuerer, luftraumbeobachter,
          created_at, deleted_at)
       VALUES (@id, @participant_id, @task_id, @datum, @drohnensteuerer,
          @luftraumbeobachter, @created_at, @deleted_at)
       ON CONFLICT(id) DO UPDATE SET
         task_id = excluded.task_id,
         datum = excluded.datum,
         drohnensteuerer = excluded.drohnensteuerer,
         luftraumbeobachter = excluded.luftraumbeobachter,
         deleted_at = excluded.deleted_at`,
    );

    const statusStmt = db.prepare(
      `INSERT INTO task_status
         (participant_id, task_id, zielanzahl, nicht_anwendbar, updated_at)
       VALUES (@participant_id, @task_id, @zielanzahl, @nicht_anwendbar, @updated_at)
       ON CONFLICT(participant_id, task_id) DO UPDATE SET
         zielanzahl = excluded.zielanzahl,
         nicht_anwendbar = excluded.nicht_anwendbar,
         updated_at = excluded.updated_at
       WHERE excluded.updated_at > task_status.updated_at`,
    );

    const tx = db.transaction(() => {
      const ts = jetzt();
      for (const e of req.executions) {
        execStmt.run({
          id: e.id,
          participant_id: participantId,
          task_id: e.taskId,
          datum: e.datum,
          drohnensteuerer: e.drohnensteuerer ?? '',
          luftraumbeobachter: e.luftraumbeobachter ?? '',
          created_at: ts,
          deleted_at: e.deletedAt ?? null,
        });
      }
      for (const s of req.taskStatus) {
        statusStmt.run({
          participant_id: participantId,
          task_id: s.taskId,
          zielanzahl: s.zielanzahl ?? null,
          nicht_anwendbar: s.nichtAnwendbar ? 1 : 0,
          updated_at: s.updatedAt,
        });
      }
    });
    tx();

    return this.fortschritt(participantId);
  },

  /** Überblick über alle Teilnehmer (erledigt/gesamt/quote je Teilnehmer). */
  teilnehmerUebersicht(): ParticipantProgressDTO[] {
    return this.alleTeilnehmer().map((p) => ({
      participant: p,
      ...aggregat(teilnehmerAufgaben(p.id)),
    }));
  },

  /**
   * Vollständige Detail-Auswertung eines Teilnehmers: Gesamtquote, Quoten je
   * Teil (1–3) und die Aufschlüsselung pro Aufgabe sowie die letzte Aktivität.
   */
  teilnehmerDetail(id: string): ParticipantDetailDTO {
    const participant = this.teilnehmerById(id);
    if (!participant) throw new NotFound('Teilnehmer nicht gefunden');

    const aufgaben = teilnehmerAufgaben(id);
    const teilNummern: Teil[] = [1, 2, 3];
    const teile: TeilStatDTO[] = teilNummern
      .map((teil) => {
        const anwendbar = aufgaben.filter((a) => a.teil === teil && !a.nichtAnwendbar);
        const gesamt = anwendbar.length;
        const erledigt = anwendbar.filter((a) => a.erledigt).length;
        return { teil, erledigt, gesamt, quote: gesamt > 0 ? erledigt / gesamt : 0 };
      })
      .filter((s) => s.gesamt > 0);

    const letzteExec = getDb()
      .prepare(
        `SELECT MAX(created_at) AS m FROM executions
         WHERE participant_id = ? AND deleted_at IS NULL`,
      )
      .get(id) as { m: string | null };
    const kandidaten = [participant.lastSeen, letzteExec.m].filter(
      (x): x is string => x != null,
    );
    const letzteAktivitaet = kandidaten.length ? kandidaten.sort().at(-1)! : null;

    return { participant, ...aggregat(aufgaben), teile, aufgaben, letzteAktivitaet };
  },
};

/**
 * Aufgaben-Aufschlüsselung eines Teilnehmers über den aktiven Katalog. Spiegelt
 * die Logik aus src/domain/progress.ts: effektive Zielanzahl =
 * task_status.zielanzahl ?? tasks.zielanzahl_default (min. 1); erledigt, wenn die
 * Anzahl nicht-gelöschter Durchführungen ≥ Zielanzahl und die Aufgabe anwendbar ist.
 */
function teilnehmerAufgaben(participantId: string): TaskProgressDTO[] {
  const db = getDb();
  const tasks = repo.alleTasks(false); // nur aktive, sortiert

  const execRows = db
    .prepare(
      `SELECT task_id, COUNT(*) AS anzahl, MAX(datum) AS letzte
       FROM executions
       WHERE participant_id = ? AND deleted_at IS NULL
       GROUP BY task_id`,
    )
    .all(participantId) as Array<{ task_id: string; anzahl: number; letzte: string | null }>;
  const execMap = new Map(execRows.map((r) => [r.task_id, r]));

  const statusRows = db
    .prepare(
      `SELECT task_id, zielanzahl, nicht_anwendbar FROM task_status WHERE participant_id = ?`,
    )
    .all(participantId) as Array<{
    task_id: string;
    zielanzahl: number | null;
    nicht_anwendbar: number;
  }>;
  const statusMap = new Map(statusRows.map((r) => [r.task_id, r]));

  return tasks.map((t) => {
    const ex = execMap.get(t.id);
    const st = statusMap.get(t.id);
    const anzahl = ex?.anzahl ?? 0;
    const nichtAnwendbar = st?.nicht_anwendbar === 1;
    const ziel = Math.max(1, st?.zielanzahl ?? t.zielanzahlDefault);
    return {
      taskId: t.id,
      teil: t.teil,
      nummer: t.nummer,
      titel: t.titel,
      anzahl,
      ziel,
      erledigt: !nichtAnwendbar && anzahl >= ziel,
      nichtAnwendbar,
      letzteDurchfuehrung: ex?.letzte ?? null,
    };
  });
}

/** Aggregiert eine Aufgabenliste zu erledigt/gesamt/quote (nicht anwendbare zählen nicht). */
function aggregat(aufgaben: TaskProgressDTO[]): {
  erledigt: number;
  gesamt: number;
  quote: number;
} {
  const anwendbar = aufgaben.filter((a) => !a.nichtAnwendbar);
  const gesamt = anwendbar.length;
  const erledigt = anwendbar.filter((a) => a.erledigt).length;
  return { erledigt, gesamt, quote: gesamt > 0 ? erledigt / gesamt : 0 };
}

/** Fehler-Marker für „nicht gefunden" (Routes mappen auf 404). */
export class NotFound extends Error {
  readonly code = 'not_found';
  constructor(message = 'Nicht gefunden') {
    super(message);
    this.name = 'NotFound';
  }
}
