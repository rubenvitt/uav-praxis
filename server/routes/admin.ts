import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../auth/middleware.ts';
import { getIdentity, requireAdmin } from '../auth/middleware.ts';
import { repo } from '../db/repo.ts';
import { fehler, jsonBody } from '../http.ts';

/** /api/admin/* — Kurse, Teilnehmer, Katalog-CRUD, Kurs-Auswertung. */
export const adminRouter = new Hono<AppEnv>();

// Alle Admin-Routen hinter requireAdmin.
adminRouter.use('*', requireAdmin);

function adminId(c: Context<AppEnv>): string | null {
  const id = getIdentity(c);
  return id.kind === 'admin' ? id.id : null;
}

// ── Kurse ───────────────────────────────────────────────────────────────────

adminRouter.get('/courses', (c) => c.json(repo.alleKurse()));

const kursAnlegenSchema = z.object({
  name: z.string().min(1),
  beschreibung: z.string().nullable().optional(),
  beginn: z.string().nullable().optional(),
});

adminRouter.post('/courses', async (c) => {
  const body = await jsonBody(c, kursAnlegenSchema);
  const kurs = repo.kursAnlegen(
    {
      name: body.name,
      beschreibung: body.beschreibung ?? null,
      beginn: body.beginn ?? null,
    },
    adminId(c),
  );
  return c.json(kurs, 201);
});

const kursPatchSchema = z.object({
  name: z.string().min(1).optional(),
  beschreibung: z.string().nullable().optional(),
  beginn: z.string().nullable().optional(),
  archiviert: z.boolean().optional(),
});

adminRouter.patch('/courses/:id', async (c) => {
  const body = await jsonBody(c, kursPatchSchema);
  const kurs = repo.kursAendern(c.req.param('id'), body);
  return c.json(kurs);
});

adminRouter.delete('/courses/:id', (c) => {
  repo.kursLoeschen(c.req.param('id'));
  return c.json({ ok: true });
});

adminRouter.get('/courses/:id/participants', (c) => {
  return c.json(repo.teilnehmerDesKurses(c.req.param('id')));
});

adminRouter.get('/courses/:id/progress', (c) => {
  return c.json(repo.kursFortschritt(c.req.param('id')));
});

// CSV-Export der Auswertung
adminRouter.get('/courses/:id/export', (c) => {
  const courseId = c.req.param('id');
  const kurs = repo.kursById(courseId);
  if (!kurs) return fehler(c, 404, 'not_found', 'Kurs nicht gefunden');

  const zeilen = repo.kursFortschritt(courseId);
  const header = ['Name', 'Code', 'Aktiv', 'Erledigt', 'Gesamt', 'Quote', 'ZuletztGesehen'];
  const csvFeld = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const rows = zeilen.map((z) =>
    [
      z.participant.name,
      z.participant.loginCode,
      z.participant.aktiv ? 'ja' : 'nein',
      String(z.erledigt),
      String(z.gesamt),
      `${Math.round(z.quote * 100)}%`,
      z.participant.lastSeen ?? '',
    ]
      .map(csvFeld)
      .join(','),
  );
  const csv = '﻿' + [header.map(csvFeld).join(','), ...rows].join('\r\n') + '\r\n';

  const dateiname = `kurs-${kurs.name.replace(/[^\w-]+/g, '_')}-auswertung.csv`;
  c.header('Content-Type', 'text/csv; charset=utf-8');
  c.header('Content-Disposition', `attachment; filename="${dateiname}"`);
  return c.body(csv);
});

// ── Teilnehmer ───────────────────────────────────────────────────────────────

const teilnehmerAnlegenSchema = z.object({ name: z.string().min(1) });

adminRouter.post('/courses/:id/participants', async (c) => {
  const body = await jsonBody(c, teilnehmerAnlegenSchema);
  const teilnehmer = repo.teilnehmerAnlegen(c.req.param('id'), body.name);
  return c.json(teilnehmer, 201);
});

const teilnehmerPatchSchema = z.object({
  name: z.string().min(1).optional(),
  aktiv: z.boolean().optional(),
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
    sortOrder: body.sortOrder ?? 0,
    aktiv: body.aktiv,
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
});

adminRouter.patch('/tasks/:id', async (c) => {
  const body = await jsonBody(c, taskPatchSchema);
  const task = repo.taskAendern(c.req.param('id'), body);
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
