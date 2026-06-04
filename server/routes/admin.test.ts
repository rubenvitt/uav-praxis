import '../test/_env.ts';
import { beforeEach, describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { closeDb, getDb } from '../db/client.ts';
import { repo } from '../db/repo.ts';
import { adminRouter } from './admin.ts';
import { onError } from '../http.ts';
import { sessionErzeugen, COOKIE_NAME } from '../auth/sessions.ts';
import type { AppEnv } from '../auth/middleware.ts';

function app() {
  const a = new Hono<AppEnv>();
  a.onError(onError);
  a.route('/api/admin', adminRouter);
  return a;
}

function adminCookie(): string {
  const id = repo.adminUpserten('sub-1', 'admin@example.org', 'Admin');
  const token = sessionErzeugen('admin', id);
  return `${COOKIE_NAME}=${token}`;
}

beforeEach(() => {
  closeDb();
  getDb();
});

describe('Admin-Routen (HTTP)', () => {
  it('lehnt ohne Admin-Session mit 401 ab', async () => {
    const res = await app().request('/api/admin/participants');
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('unauthorized');
  });

  it('legt Teilnehmer an und liefert CSV-Überblick', async () => {
    const cookie = adminCookie();
    const a = app();

    const tnRes = await a.request('/api/admin/participants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: 'Erika', beginn: '2026-06-01' }),
    });
    expect(tnRes.status).toBe(201);
    const tn = (await tnRes.json()) as { id: string; loginCode: string; beginn: string | null };
    expect(tn.loginCode).toHaveLength(8);
    expect(tn.beginn).toBe('2026-06-01');

    const csvRes = await a.request('/api/admin/participants/export', {
      headers: { Cookie: cookie },
    });
    expect(csvRes.status).toBe(200);
    expect(csvRes.headers.get('content-type')).toContain('text/csv');
    const csv = await csvRes.text();
    expect(csv).toContain('Erika');
    expect(csv).toContain('2026-06-01');
  });

  it('liefert Detail-Auswertung (Quote, Teile, Aufgaben)', async () => {
    const cookie = adminCookie();
    const a = app();

    const tnRes = await a.request('/api/admin/participants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: 'Frieda' }),
    });
    const tn = (await tnRes.json()) as { id: string };

    const detRes = await a.request(`/api/admin/participants/${tn.id}`, {
      headers: { Cookie: cookie },
    });
    expect(detRes.status).toBe(200);
    const detail = (await detRes.json()) as {
      participant: { name: string };
      quote: number;
      teile: unknown[];
      aufgaben: unknown[];
    };
    expect(detail.participant.name).toBe('Frieda');
    expect(detail).toHaveProperty('teile');
    expect(detail).toHaveProperty('aufgaben');
  });

  it('maskiert CSV-Formel-Injection im Export (führender Apostroph)', async () => {
    const cookie = adminCookie();
    const a = app();

    // Name beginnt mit '=' → muss im CSV mit führendem Apostroph neutralisiert sein.
    await a.request('/api/admin/participants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: '=SUM(A1:A9)' }),
    });

    const csvRes = await a.request('/api/admin/participants/export', {
      headers: { Cookie: cookie },
    });
    const csv = await csvRes.text();
    expect(csv).toContain(`"'=SUM(A1:A9)"`);
    expect(csv).not.toContain(`"=SUM(A1:A9)"`);
  });

  it('validiert Eingaben (400 bei fehlendem Namen)', async () => {
    const cookie = adminCookie();
    const res = await app().request('/api/admin/participants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('validation_error');
  });

  it('reordert Tasks (sort_order folgt der ids-Reihenfolge)', async () => {
    const cookie = adminCookie();
    repo.taskAnlegen({ id: 'a', teil: 1, nummer: '1', titel: 'A', lernziel: '', schritte: [], durchfuehrungshinweise: [], sicherheitshinweise: [], zielanzahlDefault: 1, sortOrder: 0, aktiv: true });
    repo.taskAnlegen({ id: 'b', teil: 1, nummer: '2', titel: 'B', lernziel: '', schritte: [], durchfuehrungshinweise: [], sicherheitshinweise: [], zielanzahlDefault: 1, sortOrder: 1, aktiv: true });

    const res = await app().request('/api/admin/tasks/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ ids: ['b', 'a'] }),
    });
    expect(res.status).toBe(200);

    const tasks = repo.alleTasks(true);
    expect(tasks.map((t) => t.id)).toEqual(['b', 'a']);
  });

  it('hängt neu angelegte Aufgaben ans Ende an (sort_order = maxSort + 1)', async () => {
    const cookie = adminCookie();
    const a = app();
    const anlegen = (titel: string, nummer: string) =>
      a.request('/api/admin/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ teil: 1, nummer, titel }),
      });
    // Bewusst absteigende Nummern: ein fehlerhaftes sort_order = 0 für beide
    // würde die Reihenfolge über `nummer` (statt Anlege-Reihenfolge) sortieren.
    await anlegen('Erste', '9');
    await anlegen('Zweite', '1');

    const tasks = repo.alleTasks(true);
    expect(tasks.map((t) => t.titel)).toEqual(['Erste', 'Zweite']);
  });

  it('speichert, aktualisiert und leert bildUrl pro Aufgabe', async () => {
    const cookie = adminCookie();
    const a = app();

    const createRes = await a.request('/api/admin/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        teil: 1,
        nummer: '1',
        titel: 'Mit Bild',
        bildUrl: '/illustrations/1-1.webp',
      }),
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as { id: string; bildUrl: string | null };
    expect(created.bildUrl).toBe('/illustrations/1-1.webp');

    const patchRes = await a.request(`/api/admin/tasks/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ bildUrl: 'https://example.org/bild.png' }),
    });
    expect(patchRes.status).toBe(200);
    expect(((await patchRes.json()) as { bildUrl: string | null }).bildUrl).toBe(
      'https://example.org/bild.png',
    );

    // Leerer/whitespace String → null (Bild entfernen).
    const clearRes = await a.request(`/api/admin/tasks/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ bildUrl: '   ' }),
    });
    expect(((await clearRes.json()) as { bildUrl: string | null }).bildUrl).toBeNull();
  });
});
