import { createHash, randomBytes } from 'node:crypto';
import type { Context } from 'hono';
import { setCookie, deleteCookie } from 'hono/cookie';
import type { Identity } from '../../shared/types.ts';
import { getDb } from '../db/client.ts';
import { env } from '../env.ts';

export type SessionKind = 'admin' | 'participant';

export const COOKIE_NAME = 'sid';

const TAG = 24 * 60 * 60 * 1000;
const PARTICIPANT_TTL_MS = 180 * TAG; // 180 Tage (Dauer-Charakter)
const ADMIN_TTL_MS = 7 * TAG; // 7 Tage

interface SessionRow {
  token: string;
  kind: SessionKind;
  subject_id: string;
  expires_at: string;
}

interface AdminRow {
  id: string;
  name: string | null;
  email: string | null;
}

interface ParticipantJoinRow {
  id: string;
  name: string;
  course_id: string;
  course_name: string;
}

/**
 * Defense-in-depth: in der DB wird nur der SHA-256-Hash des Tokens gespeichert,
 * nie das Roh-Token. Das Roh-Token lebt ausschließlich im httpOnly-Cookie.
 */
function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Erzeugt eine neue Session (DB-backed) und liefert das opake Roh-Token. */
export function sessionErzeugen(kind: SessionKind, subjectId: string): string {
  const db = getDb();
  const token = randomBytes(32).toString('base64url');
  const now = Date.now();
  const ttl = kind === 'admin' ? ADMIN_TTL_MS : PARTICIPANT_TTL_MS;
  db.prepare(
    `INSERT INTO sessions (token, kind, subject_id, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(
    tokenHash(token),
    kind,
    subjectId,
    new Date(now).toISOString(),
    new Date(now + ttl).toISOString(),
  );
  return token;
}

/** Validiert ein Roh-Token (Cookie-Wert) und liefert die Identität oder null. */
export function sessionValidieren(token: string): Identity | null {
  if (!token) return null;
  const db = getDb();
  const hash = tokenHash(token);
  const row = db
    .prepare(`SELECT token, kind, subject_id, expires_at FROM sessions WHERE token = ?`)
    .get(hash) as SessionRow | undefined;
  if (!row) return null;

  if (new Date(row.expires_at).getTime() <= Date.now()) {
    db.prepare(`DELETE FROM sessions WHERE token = ?`).run(hash);
    return null;
  }

  if (row.kind === 'admin') {
    const admin = db
      .prepare(`SELECT id, name, email FROM admins WHERE id = ?`)
      .get(row.subject_id) as AdminRow | undefined;
    if (!admin) return null;
    return { kind: 'admin', id: admin.id, name: admin.name, email: admin.email };
  }

  // participant
  const p = db
    .prepare(
      `SELECT p.id, p.name, p.course_id, c.name AS course_name
       FROM participants p JOIN courses c ON c.id = p.course_id
       WHERE p.id = ? AND p.aktiv = 1`,
    )
    .get(row.subject_id) as ParticipantJoinRow | undefined;
  if (!p) return null;
  return {
    kind: 'participant',
    id: p.id,
    name: p.name,
    course: { id: p.course_id, name: p.course_name },
  };
}

/** Löscht die Session zum Roh-Token (Logout). */
export function sessionLoeschen(token: string): void {
  if (!token) return;
  getDb().prepare(`DELETE FROM sessions WHERE token = ?`).run(tokenHash(token));
}

/** Setzt das Session-Cookie mit der passenden Laufzeit. */
export function sessionCookieSetzen(c: Context, token: string, kind: SessionKind): void {
  const maxAge = (kind === 'admin' ? ADMIN_TTL_MS : PARTICIPANT_TTL_MS) / 1000;
  setCookie(c, COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'Lax',
    secure: env.cookieSecure,
    path: '/',
    maxAge,
  });
}

/** Entfernt das Session-Cookie. */
export function sessionCookieLoeschen(c: Context): void {
  deleteCookie(c, COOKIE_NAME, { path: '/' });
}
