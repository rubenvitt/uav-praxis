import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { getDb } from './client.ts';
import { AUFGABEN } from '../../src/data/tasks.ts';

/**
 * Importiert AUFGABEN aus src/data/tasks.ts als globalen Katalog-Seed.
 * Upsert pro Aufgabe (id bleibt erhalten): teil/nummer/titel/lernziel/schritte/
 * durchfuehrungshinweise/sicherheitshinweise/zielanzahl_default werden gesetzt,
 * sort_order entspricht der Reihenfolge im Array. bild zeigt auf
 * public/illustrations/<id>.webp, falls die Datei existiert, sonst NULL.
 *
 * Idempotent und nicht-destruktiv: fehlende Tasks werden angelegt; bei bereits
 * vorhandenen Tasks wird NUR der bild-Pfad aktualisiert (für den
 * Illustrations-Workflow §14). Admin-Bearbeitungen (Titel, Zielanzahl,
 * Reihenfolge, aktiv-Flag, ...) bleiben über Neustarts hinweg erhalten.
 */
export function seed(): void {
  const db = getDb();
  const illuDir = resolve(process.cwd(), 'public', 'illustrations');

  const stmt = db.prepare(
    `INSERT INTO tasks
       (id, teil, nummer, titel, lernziel, schritte, durchfuehrungshinweise,
        sicherheitshinweise, zielanzahl_default, sort_order, aktiv, bild, updated_at)
     VALUES (@id, @teil, @nummer, @titel, @lernziel, @schritte,
        @durchfuehrungshinweise, @sicherheitshinweise, @zielanzahl_default,
        @sort_order, 1, @bild, @updated_at)
     ON CONFLICT(id) DO UPDATE SET
       bild = excluded.bild`,
  );

  const ts = new Date().toISOString();

  const tx = db.transaction(() => {
    AUFGABEN.forEach((a, index) => {
      const webp = resolve(illuDir, `${a.id}.webp`);
      const png = resolve(illuDir, `${a.id}.png`);
      let bild: string | null = null;
      if (existsSync(webp)) bild = `/illustrations/${a.id}.webp`;
      else if (existsSync(png)) bild = `/illustrations/${a.id}.png`;

      stmt.run({
        id: a.id,
        teil: a.teil,
        nummer: a.nummer,
        titel: a.titel,
        lernziel: a.lernziel ?? '',
        schritte: JSON.stringify(a.schritte ?? []),
        durchfuehrungshinweise: JSON.stringify(a.durchfuehrungshinweise ?? []),
        sicherheitshinweise: JSON.stringify(a.sicherheitshinweise ?? []),
        zielanzahl_default: a.zielanzahlDefault ?? 1,
        sort_order: index,
        bild,
        updated_at: ts,
      });
    });
  });
  tx();
}
