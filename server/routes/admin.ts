import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../auth/middleware.ts';
import { requireAdmin } from '../auth/middleware.ts';
import { repo } from '../db/repo.ts';
import { jsonBody } from '../http.ts';

/** /api/admin/* — Teilnehmer, Katalog-CRUD, Auswertung (Überblick + Detail). */
export const adminRouter = new Hono<AppEnv>();

// Alle Admin-Routen hinter requireAdmin.
adminRouter.use('*', requireAdmin);

/**
 * CSV-Feld escapen und gegen Formel-Injection härten: Werte, die (auch nach
 * führendem Tab/CR) mit = + - @ beginnen, mit führendem Apostroph neutralisieren.
 */
function csvFeld(v: string): string {
  const sicher = /^[\t\r]*[=+\-@]/.test(v) ? `'${v}` : v;
  return `"${sicher.replace(/"/g, '""')}"`;
}

function csvAntwort(c: Context<AppEnv>, zeilen: string[][], dateiname: string) {
  const csv = '﻿' + zeilen.map((z) => z.map(csvFeld).join(',')).join('\r\n') + '\r\n';
  c.header('Content-Type', 'text/csv; charset=utf-8');
  c.header('Content-Disposition', `attachment; filename="${dateiname}"`);
  return c.body(csv);
}

function dateiSlug(s: string): string {
  return s.replace(/[^\w-]+/g, '_');
}

// ── Teilnehmer ───────────────────────────────────────────────────────────────

// Überblick: eine Zeile pro Teilnehmer (erledigt/gesamt/quote + letzte Aktivität).
adminRouter.get('/participants', (c) => c.json(repo.teilnehmerUebersicht()));

const teilnehmerAnlegenSchema = z.object({
  name: z.string().min(1),
  beginn: z.string().nullable().optional(),
});

adminRouter.post('/participants', async (c) => {
  const body = await jsonBody(c, teilnehmerAnlegenSchema);
  const teilnehmer = repo.teilnehmerAnlegen(body.name, body.beginn ?? null);
  return c.json(teilnehmer, 201);
});

// Überblick-CSV (vor :id registrieren, damit "export" nicht als :id matched).
adminRouter.get('/participants/export', (c) => {
  const header = ['Name', 'Beginn', 'Erledigt', 'Gesamt', 'Quote', 'LetzteAktivität', 'Status'];
  const rows = repo.teilnehmerUebersicht().map((z) => [
    z.participant.name,
    z.participant.beginn ?? '',
    String(z.erledigt),
    String(z.gesamt),
    `${Math.round(z.quote * 100)}%`,
    z.participant.lastSeen ?? '',
    z.participant.aktiv ? 'aktiv' : 'inaktiv',
  ]);
  return csvAntwort(c, [header, ...rows], 'teilnehmer-uebersicht.csv');
});

// Detail-Auswertung eines Teilnehmers.
adminRouter.get('/participants/:id', (c) => {
  return c.json(repo.teilnehmerDetail(c.req.param('id')));
});

// Detail-CSV: eine Zeile pro Aufgabe.
adminRouter.get('/participants/:id/export', (c) => {
  const detail = repo.teilnehmerDetail(c.req.param('id'));
  const header = ['Teil', 'Nummer', 'Titel', 'Anzahl', 'Ziel', 'Erledigt', 'NichtAnwendbar', 'LetzteDurchführung'];
  const rows = detail.aufgaben.map((a) => [
    String(a.teil),
    a.nummer,
    a.titel,
    String(a.anzahl),
    String(a.ziel),
    a.erledigt ? 'ja' : 'nein',
    a.nichtAnwendbar ? 'ja' : 'nein',
    a.letzteDurchfuehrung ?? '',
  ]);
  return csvAntwort(c, [header, ...rows], `teilnehmer-${dateiSlug(detail.participant.name)}-auswertung.csv`);
});

const teilnehmerPatchSchema = z.object({
  name: z.string().min(1).optional(),
  aktiv: z.boolean().optional(),
  beginn: z.string().nullable().optional(),
  codeNeu: z.boolean().optional(),
});

adminRouter.patch('/participants/:id', async (c) => {
  const body = await jsonBody(c, teilnehmerPatchSchema);
  const teilnehmer = repo.teilnehmerAendern(c.req.param('id'), body);
  return c.json(teilnehmer);
});

adminRouter.delete('/participants/:id', (c) => {
  repo.teilnehmerLoeschen(c.req.param('id'));
  return c.json({ ok: true });
});

// ── Aufgabenkatalog ──────────────────────────────────────────────────────────

adminRouter.get('/tasks', (c) => c.json(repo.alleTasks(true)));

const teilSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);

const taskAnlegenSchema = z.object({
  id: z.string().min(1).optional(),
  teil: teilSchema,
  nummer: z.string().min(1),
  titel: z.string().min(1),
  lernziel: z.string().default(''),
  schritte: z.array(z.string()).default([]),
  durchfuehrungshinweise: z.array(z.string()).default([]),
  sicherheitshinweise: z.array(z.string()).default([]),
  zielanzahlDefault: z.number().int().positive().default(1),
  sortOrder: z.number().int().optional(),
  aktiv: z.boolean().default(true),
  // Relativer Pfad (z. B. /illustrations/1-1.webp) oder absolute URL — daher kein
  // .url(); leerer String wird zu null normalisiert.
  bildUrl: z.string().nullable().optional(),
});

adminRouter.post('/tasks', async (c) => {
  const body = await jsonBody(c, taskAnlegenSchema);
  const task = repo.taskAnlegen({
    id: body.id,
    teil: body.teil,
    nummer: body.nummer,
    titel: body.titel,
    lernziel: body.lernziel,
    schritte: body.schritte,
    durchfuehrungshinweise: body.durchfuehrungshinweise,
    sicherheitshinweise: body.sicherheitshinweise,
    zielanzahlDefault: body.zielanzahlDefault,
    // Kein Default: bei fehlendem sortOrder hängt das Repo die Aufgabe ans Ende
    // an (maxSort + 1). Ein `?? 0` würde diese Append-Logik aushebeln.
    sortOrder: body.sortOrder,
    aktiv: body.aktiv,
    bildUrl: body.bildUrl?.trim() ? body.bildUrl.trim() : null,
  });
  return c.json(task, 201);
});

const taskPatchSchema = z.object({
  teil: teilSchema.optional(),
  nummer: z.string().min(1).optional(),
  titel: z.string().min(1).optional(),
  lernziel: z.string().optional(),
  schritte: z.array(z.string()).optional(),
  durchfuehrungshinweise: z.array(z.string()).optional(),
  sicherheitshinweise: z.array(z.string()).optional(),
  zielanzahlDefault: z.number().int().positive().optional(),
  sortOrder: z.number().int().optional(),
  aktiv: z.boolean().optional(),
  bildUrl: z.string().nullable().optional(),
});

adminRouter.patch('/tasks/:id', async (c) => {
  const body = await jsonBody(c, taskPatchSchema);
  // Leerer String = Bild entfernen (→ null); fehlendes Feld = unverändert lassen.
  const patch =
    typeof body.bildUrl === 'string'
      ? { ...body, bildUrl: body.bildUrl.trim() || null }
      : body;
  const task = repo.taskAendern(c.req.param('id'), patch);
  return c.json(task);
});

adminRouter.delete('/tasks/:id', (c) => {
  repo.taskLoeschen(c.req.param('id'));
  return c.json({ ok: true });
});

const reorderSchema = z.object({ ids: z.array(z.string().min(1)) });

adminRouter.post('/tasks/reorder', async (c) => {
  const body = await jsonBody(c, reorderSchema);
  repo.tasksNeuSortieren(body.ids);
  return c.json({ ok: true });
});
