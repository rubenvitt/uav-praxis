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
    const res = await app().request('/api/admin/courses');
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('unauthorized');
  });

  it('legt Kurs + Teilnehmer an und liefert CSV-Export', async () => {
    const cookie = adminCookie();
    const a = app();

    const kursRes = await a.request('/api/admin/courses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: 'Kurs HTTP' }),
    });
    expect(kursRes.status).toBe(201);
    const kurs = (await kursRes.json()) as { id: string; name: string };
    expect(kurs.name).toBe('Kurs HTTP');

    const tnRes = await a.request(`/api/admin/courses/${kurs.id}/participants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: 'Erika' }),
    });
    expect(tnRes.status).toBe(201);
    const tn = (await tnRes.json()) as { loginCode: string };
    expect(tn.loginCode).toHaveLength(8);

    const csvRes = await a.request(`/api/admin/courses/${kurs.id}/export`, {
      headers: { Cookie: cookie },
    });
    expect(csvRes.status).toBe(200);
    expect(csvRes.headers.get('content-type')).toContain('text/csv');
    const csv = await csvRes.text();
    expect(csv).toContain('Erika');
    expect(csv).toContain(tn.loginCode);
  });

  it('validiert Eingaben (400 bei fehlendem Namen)', async () => {
    const cookie = adminCookie();
    const res = await app().request('/api/admin/courses', {
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
});
