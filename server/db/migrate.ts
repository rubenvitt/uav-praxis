import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import type { Db } from './client.ts';

/**
 * Pfad zu schema.sql. Bevorzugt das file:-URL relativ zum Modul (tsx/Produktion);
 * unter Vite/Vitest ist import.meta.url ein http:-URL — dann relativ zum
 * Arbeitsverzeichnis (Projekt-Root) auflösen.
 */
function schemaPfad(): string {
  try {
    if (import.meta.url.startsWith('file:')) {
      return fileURLToPath(new URL('./schema.sql', import.meta.url));
    }
  } catch {
    // fällt unten auf cwd-Variante zurück
  }
  return resolve(process.cwd(), 'server', 'db', 'schema.sql');
}

/**
 * Führt schema.sql aus (idempotent, IF NOT EXISTS) und wendet leichte
 * Migrationen für bestehende Datenbanken an (z. B. neue Spalten).
 */
export function migrate(db: Db): void {
  const schema = readFileSync(schemaPfad(), 'utf8');
  db.exec(schema);

  // Leichte Migration: 'bild'-Spalte für Bestandsdatenbanken ohne sie ergänzen.
  const tasksSpalten = db
    .prepare(`PRAGMA table_info(tasks)`)
    .all() as Array<{ name: string }>;
  if (!tasksSpalten.some((s) => s.name === 'bild')) {
    db.exec(`ALTER TABLE tasks ADD COLUMN bild TEXT`);
  }

  kurskonzeptEntfernen(db);
}

/**
 * Migration „Kurskonzept entfernen": Bestandsdatenbanken haben participants noch
 * mit course_id (NOT NULL, FK → courses) und ohne beginn. Wir bauen participants
 * per Tabellen-Rebuild neu auf (offizielle SQLite-Prozedur, robust gegen die
 * eingehenden FKs aus executions/task_status), retten beginn aus dem Kurs und
 * verwerfen die courses-Tabelle. Idempotent: läuft nur, solange course_id existiert.
 */
function kurskonzeptEntfernen(db: Db): void {
  const spalten = db
    .prepare(`PRAGMA table_info(participants)`)
    .all() as Array<{ name: string }>;
  if (!spalten.some((s) => s.name === 'course_id')) return; // bereits migriert

  // PRAGMA foreign_keys lässt sich nicht innerhalb einer Transaktion ändern.
  db.exec('PRAGMA foreign_keys = OFF');
  const rebuild = db.transaction(() => {
    db.exec(`
      CREATE TABLE participants_new (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        login_code  TEXT UNIQUE NOT NULL,
        aktiv       INTEGER NOT NULL DEFAULT 1,
        beginn      TEXT,
        created_at  TEXT NOT NULL,
        last_seen   TEXT
      );
      INSERT INTO participants_new (id, name, login_code, aktiv, beginn, created_at, last_seen)
        SELECT p.id, p.name, p.login_code, p.aktiv,
               (SELECT c.beginn FROM courses c WHERE c.id = p.course_id),
               p.created_at, p.last_seen
        FROM participants p;
      DROP TABLE participants;
      ALTER TABLE participants_new RENAME TO participants;
      DROP TABLE IF EXISTS courses;
    `);
  });
  rebuild();
  // Tatsächlich auswerten: bei FK-Verletzungen abbrechen, statt stillschweigend
  // eine inkonsistente DB zu hinterlassen.
  const verletzungen = db.prepare('PRAGMA foreign_key_check').all();
  if (verletzungen.length > 0) {
    throw new Error(
      `Migration „Kurskonzept entfernen": ${verletzungen.length} Foreign-Key-Verletzung(en) nach Rebuild.`,
    );
  }
  db.exec('PRAGMA foreign_keys = ON');
}
