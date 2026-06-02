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
}
