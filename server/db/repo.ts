import { randomUUID } from 'node:crypto';
import type {
  CourseDTO,
  ExecutionDTO,
  ParticipantDTO,
  ParticipantProgressDTO,
  ProgressSnapshot,
  SyncRequest,
  TaskDTO,
  TaskStatusDTO,
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
  updated_at: string;
}

interface CourseRow {
  id: string;
  name: string;
  beschreibung: string | null;
  beginn: string | null;
  archiviert: number;
  teilnehmer_anzahl?: number;
}

interface ParticipantRow {
  id: string;
  course_id: string;
  name: string;
  login_code: string;
  aktiv: number;
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
  };
}

function mapCourse(r: CourseRow): CourseDTO {
  return {
    id: r.id,
    name: r.name,
    beschreibung: r.beschreibung,
    beginn: r.beginn,
    archiviert: r.archiviert === 1,
    teilnehmerAnzahl: r.teilnehmer_anzahl,
  };
}

function mapParticipant(r: ParticipantRow): ParticipantDTO {
  return {
    id: r.id,
    courseId: r.course_id,
    name: r.name,
    loginCode: r.login_code,
    aktiv: r.aktiv === 1,
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

  taskAnlegen(task: Omit<TaskDTO, 'id'> & { id?: string }): TaskDTO {
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
         sicherheitshinweise, zielanzahl_default, sort_order, aktiv, updated_at)
       VALUES (@id, @teil, @nummer, @titel, @lernziel, @schritte,
         @durchfuehrungshinweise, @sicherheitshinweise, @zielanzahl_default,
         @sort_order, @aktiv, @updated_at)`,
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
         aktiv = @aktiv, updated_at = @updated_at
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

  // ── Kurse ────────────────────────────────────────────────────────────────

  alleKurse(): CourseDTO[] {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT c.*,
                (SELECT COUNT(*) FROM participants p WHERE p.course_id = c.id)
                  AS teilnehmer_anzahl
         FROM courses c
         ORDER BY c.archiviert, c.created_at DESC`,
      )
      .all() as CourseRow[];
    return rows.map(mapCourse);
  },

  kursById(id: string): CourseDTO | null {
    const r = getDb()
      .prepare(
        `SELECT c.*,
                (SELECT COUNT(*) FROM participants p WHERE p.course_id = c.id)
                  AS teilnehmer_anzahl
         FROM courses c WHERE c.id = ?`,
      )
      .get(id) as CourseRow | undefined;
    return r ? mapCourse(r) : null;
  },

  kursAnlegen(
    kurs: Partial<CourseDTO> & { name: string },
    adminId: string | null,
  ): CourseDTO {
    const db = getDb();
    const id = randomUUID();
    db.prepare(
      `INSERT INTO courses (id, name, beschreibung, beginn, archiviert, created_by, created_at)
       VALUES (@id, @name, @beschreibung, @beginn, @archiviert, @created_by, @created_at)`,
    ).run({
      id,
      name: kurs.name,
      beschreibung: kurs.beschreibung ?? null,
      beginn: kurs.beginn ?? null,
      archiviert: kurs.archiviert ? 1 : 0,
      created_by: adminId,
      created_at: jetzt(),
    });
    return this.kursById(id)!;
  },

  kursAendern(id: string, patch: Partial<CourseDTO>): CourseDTO {
    const db = getDb();
    const vorhanden = this.kursById(id);
    if (!vorhanden) throw new NotFound('Kurs nicht gefunden');
    const next = { ...vorhanden, ...patch };
    db.prepare(
      `UPDATE courses SET name = @name, beschreibung = @beschreibung,
         beginn = @beginn, archiviert = @archiviert WHERE id = @id`,
    ).run({
      id,
      name: next.name,
      beschreibung: next.beschreibung ?? null,
      beginn: next.beginn ?? null,
      archiviert: next.archiviert ? 1 : 0,
    });
    return this.kursById(id)!;
  },

  kursLoeschen(id: string): void {
    const info = getDb().prepare(`DELETE FROM courses WHERE id = ?`).run(id);
    if (info.changes === 0) throw new NotFound('Kurs nicht gefunden');
  },

  // ── Teilnehmer ───────────────────────────────────────────────────────────

  teilnehmerDesKurses(courseId: string): ParticipantDTO[] {
    const rows = getDb()
      .prepare(`SELECT * FROM participants WHERE course_id = ? ORDER BY name`)
      .all(courseId) as ParticipantRow[];
    return rows.map(mapParticipant);
  },

  teilnehmerById(id: string): ParticipantDTO | null {
    const r = getDb()
      .prepare(`SELECT * FROM participants WHERE id = ?`)
      .get(id) as ParticipantRow | undefined;
    return r ? mapParticipant(r) : null;
  },

  teilnehmerAnlegen(courseId: string, name: string): ParticipantDTO {
    const db = getDb();
    const kurs = this.kursById(courseId);
    if (!kurs) throw new NotFound('Kurs nicht gefunden');
    const id = randomUUID();
    const code = this.eindeutigenCodeErzeugen();
    db.prepare(
      `INSERT INTO participants (id, course_id, name, login_code, aktiv, created_at)
       VALUES (?, ?, ?, ?, 1, ?)`,
    ).run(id, courseId, name, code, jetzt());
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
      `UPDATE participants SET name = @name, aktiv = @aktiv, login_code = @login_code
       WHERE id = @id`,
    ).run({
      id,
      name: next.name,
      aktiv: next.aktiv === false ? 0 : 1,
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

  /**
   * Berechnet den Kursfortschritt pro Teilnehmer. Spiegelt exakt die Logik aus
   * src/domain/progress.ts: Universum = aktive Tasks; effektive Zielanzahl =
   * task_status.zielanzahl ?? tasks.zielanzahl_default; gesamt zählt nur Tasks,
   * die nicht als nicht_anwendbar markiert sind; erledigt, wenn die Anzahl
   * nicht-gelöschter Executions ≥ effektive Zielanzahl.
   */
  kursFortschritt(courseId: string): ParticipantProgressDTO[] {
    const db = getDb();
    const teilnehmer = this.teilnehmerDesKurses(courseId);
    const tasks = this.alleTasks(false); // nur aktive

    const execCountStmt = db.prepare(
      `SELECT task_id, COUNT(*) AS anzahl
       FROM executions
       WHERE participant_id = ? AND deleted_at IS NULL
       GROUP BY task_id`,
    );
    const statusStmt = db.prepare(
      `SELECT task_id, zielanzahl, nicht_anwendbar FROM task_status WHERE participant_id = ?`,
    );

    return teilnehmer.map((p) => {
      const execCounts = new Map<string, number>();
      for (const row of execCountStmt.all(p.id) as Array<{
        task_id: string;
        anzahl: number;
      }>) {
        execCounts.set(row.task_id, row.anzahl);
      }
      const statusMap = new Map<string, { zielanzahl: number | null; nichtAnwendbar: boolean }>();
      for (const row of statusStmt.all(p.id) as Array<{
        task_id: string;
        zielanzahl: number | null;
        nicht_anwendbar: number;
      }>) {
        statusMap.set(row.task_id, {
          zielanzahl: row.zielanzahl,
          nichtAnwendbar: row.nicht_anwendbar === 1,
        });
      }

      let gesamt = 0;
      let erledigt = 0;
      for (const t of tasks) {
        const st = statusMap.get(t.id);
        if (st?.nichtAnwendbar) continue; // nicht anwendbar zählt nicht zu gesamt
        gesamt += 1;
        const ziel = Math.max(1, st?.zielanzahl ?? t.zielanzahlDefault);
        const anzahl = execCounts.get(t.id) ?? 0;
        if (anzahl >= ziel) erledigt += 1;
      }
      const quote = gesamt > 0 ? erledigt / gesamt : 0;
      return { participant: p, erledigt, gesamt, quote };
    });
  },
};

/** Fehler-Marker für „nicht gefunden" (Routes mappen auf 404). */
export class NotFound extends Error {
  readonly code = 'not_found';
  constructor(message = 'Nicht gefunden') {
    super(message);
    this.name = 'NotFound';
  }
}
