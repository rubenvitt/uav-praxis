import '../test/_env.ts';
import { describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { shimmen, type Db } from './client.ts';
import { migrate } from './migrate.ts';

/**
 * Baut eine Bestands-DB im ALTEN Schema auf (mit courses + participants.course_id,
 * ohne participants.beginn) — so wie eine produktive DB vor dem Redesign aussah.
 */
function alteDb(): Db {
  const db = shimmen(new DatabaseSync(':memory:'));
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(`
    CREATE TABLE courses (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, beschreibung TEXT, beginn TEXT,
      archiviert INTEGER NOT NULL DEFAULT 0, created_by TEXT, created_at TEXT NOT NULL
    );
    CREATE TABLE participants (
      id TEXT PRIMARY KEY,
      course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      name TEXT NOT NULL, login_code TEXT UNIQUE NOT NULL,
      aktiv INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, last_seen TEXT
    );
    CREATE TABLE executions (
      id TEXT PRIMARY KEY,
      participant_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
      task_id TEXT NOT NULL, datum TEXT NOT NULL,
      drohnensteuerer TEXT NOT NULL DEFAULT '', luftraumbeobachter TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL, deleted_at TEXT
    );
  `);
  return db;
}

describe('Migration: Kurskonzept entfernen', () => {
  it('baut participants um, rettet beginn aus dem Kurs und verwirft courses', () => {
    const db = alteDb();
    db.exec(
      `INSERT INTO courses (id, name, beginn, created_at)
       VALUES ('k1', 'Kurs A', '2026-05-01', '2026-04-01T00:00:00.000Z')`,
    );
    db.exec(
      `INSERT INTO participants (id, course_id, name, login_code, aktiv, created_at)
       VALUES ('p1', 'k1', 'Alice', 'CODE1234', 1, '2026-04-02T00:00:00.000Z')`,
    );
    db.exec(
      `INSERT INTO executions (id, participant_id, task_id, datum, created_at)
       VALUES ('e1', 'p1', 't1', '2026-05-02', '2026-05-02T10:00:00.000Z')`,
    );

    migrate(db);

    // courses ist weg
    const tabellen = (
      db.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all() as Array<{
        name: string;
      }>
    ).map((r) => r.name);
    expect(tabellen).not.toContain('courses');

    // participant hat beginn aus dem Kurs übernommen, course_id-Spalte ist weg
    const spalten = (
      db.prepare(`PRAGMA table_info(participants)`).all() as Array<{ name: string }>
    ).map((s) => s.name);
    expect(spalten).toContain('beginn');
    expect(spalten).not.toContain('course_id');

    const p = db.prepare(`SELECT id, name, beginn FROM participants WHERE id = 'p1'`).get() as {
      id: string;
      name: string;
      beginn: string | null;
    };
    expect(p.name).toBe('Alice');
    expect(p.beginn).toBe('2026-05-01');

    // Durchführungen bleiben erhalten (Rebuild mit foreign_keys OFF)
    const anzahl = (db.prepare(`SELECT COUNT(*) AS c FROM executions`).get() as { c: number }).c;
    expect(anzahl).toBe(1);
  });

  it('ist idempotent (zweiter Lauf verändert nichts)', () => {
    const db = alteDb();
    db.exec(
      `INSERT INTO courses (id, name, created_at) VALUES ('k1', 'Kurs', '2026-04-01T00:00:00.000Z')`,
    );
    db.exec(
      `INSERT INTO participants (id, course_id, name, login_code, aktiv, created_at)
       VALUES ('p1', 'k1', 'Bob', 'CODE5678', 1, '2026-04-02T00:00:00.000Z')`,
    );

    migrate(db);
    expect(() => migrate(db)).not.toThrow();

    const anzahl = (db.prepare(`SELECT COUNT(*) AS c FROM participants`).get() as { c: number }).c;
    expect(anzahl).toBe(1);
  });
});
