import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { env } from '../env.ts';
import { migrate } from './migrate.ts';

/**
 * Mit better-sqlite3 kompatible DB-Schnittstelle, gebaut auf Node's eingebautem
 * `node:sqlite` (DatabaseSync). Dadurch entfällt die native Kompilierung von
 * better-sqlite3 (unter aktuellem Node nicht baubar). `transaction()` und
 * `pragma()` werden als Shims ergänzt, sodass repo.ts/seed.ts unverändert bleiben.
 */
/**
 * Bewusst lockere Statement-Schnittstelle (wie better-sqlite3): get/all liefern
 * `unknown`, damit die bestehenden `as XRow`-Casts in repo.ts gültig bleiben.
 */
export interface Stmt {
  run(...params: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint };
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
}

export interface Db extends Omit<DatabaseSync, 'prepare'> {
  prepare(sql: string): Stmt;
  pragma(quelle: string): void;
  transaction<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R;
}

let instanz: Db | null = null;

function shimmen(db: DatabaseSync): Db {
  const erweitert = db as unknown as Db;
  erweitert.pragma = (quelle: string) => {
    db.exec(`PRAGMA ${quelle}`);
  };
  // Entspricht better-sqlite3: transaction(fn) liefert eine Funktion, die fn in
  // einer Transaktion ausführt (COMMIT bei Erfolg, ROLLBACK bei Fehler).
  erweitert.transaction = <A extends unknown[], R>(fn: (...args: A) => R) => {
    return (...args: A): R => {
      db.exec('BEGIN');
      try {
        const ergebnis = fn(...args);
        db.exec('COMMIT');
        return ergebnis;
      } catch (fehler) {
        db.exec('ROLLBACK');
        throw fehler;
      }
    };
  };
  return erweitert;
}

/**
 * DB-Singleton. Wird beim ersten Zugriff geöffnet, mit WAL und aktivierten
 * Foreign-Keys konfiguriert und einmalig migriert (idempotent).
 */
export function getDb(): Db {
  if (!instanz) {
    if (env.DATABASE_PATH !== ':memory:') {
      mkdirSync(dirname(env.DATABASE_PATH), { recursive: true });
    }
    const db = shimmen(new DatabaseSync(env.DATABASE_PATH));
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA foreign_keys = ON');
    instanz = db;
    migrate(db);
  }
  return instanz;
}

/** Schließt die DB-Verbindung und verwirft das Singleton (für Tests). */
export function closeDb(): void {
  if (instanz) {
    instanz.close();
    instanz = null;
  }
}
