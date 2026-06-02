import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import { z } from 'zod';
import type { AppEnv } from '../auth/middleware.ts';
import { identitaetAufloesen } from '../auth/middleware.ts';
import { authorizationUrl, handleCallback, oidcStatesAufraeumen } from '../auth/oidc.ts';
import { rateLimitErlaubt, teilnehmerPerCodeAnmelden } from '../auth/participant.ts';
import {
  COOKIE_NAME,
  sessionCookieLoeschen,
  sessionCookieSetzen,
  sessionErzeugen,
  sessionLoeschen,
} from '../auth/sessions.ts';
import { repo } from '../db/repo.ts';
import { env } from '../env.ts';
import { fehler, HttpError, jsonBody } from '../http.ts';

/** /api/auth/* — PocketID-OIDC (Admin), Code-Login (Teilnehmer), Logout. */
export const authRouter = new Hono<AppEnv>();

// GET /api/auth/admin/login → Redirect zu PocketID
authRouter.get('/admin/login', async (c) => {
  oidcStatesAufraeumen();
  const url = await authorizationUrl();
  return c.redirect(url);
});

// GET /api/auth/admin/callback → Admin-Session, Redirect /admin
authRouter.get('/admin/callback', async (c) => {
  const user = await handleCallback(c.req.url);

  if (env.adminAllowlist.length > 0) {
    const email = (user.email ?? '').toLowerCase();
    if (!env.adminAllowlist.includes(email)) {
      throw new HttpError(
        403,
        'forbidden',
        'Diese E-Mail ist nicht für den Admin-Zugang freigegeben.',
      );
    }
  }

  const adminId = repo.adminUpserten(user.sub, user.email, user.name);
  const token = sessionErzeugen('admin', adminId);
  sessionCookieSetzen(c, token, 'admin');
  return c.redirect('/admin');
});

// POST /api/auth/participant { code } → Teilnehmer-Session
const participantSchema = z.object({ code: z.string().min(1) });

authRouter.post('/participant', async (c) => {
  const ip =
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
    c.req.header('x-real-ip') ||
    'unknown';
  if (!rateLimitErlaubt(ip)) {
    return fehler(c, 429, 'rate_limited', 'Zu viele Versuche. Bitte später erneut versuchen.');
  }

  const { code } = await jsonBody(c, participantSchema);
  const teilnehmer = teilnehmerPerCodeAnmelden(code);
  if (!teilnehmer) {
    return fehler(c, 401, 'invalid_code', 'Ungültiger oder inaktiver Code.');
  }

  const token = sessionErzeugen('participant', teilnehmer.id);
  sessionCookieSetzen(c, token, 'participant');
  return c.json({ ok: true });
});

// POST /api/auth/logout → Session löschen
authRouter.post('/logout', async (c) => {
  const token = getCookie(c, COOKIE_NAME);
  if (token) sessionLoeschen(token);
  sessionCookieLoeschen(c);
  return c.json({ ok: true });
});

/**
 * Handler für GET /api/me (in index.ts gemountet, außerhalb von /api/auth).
 * Liefert die aktuelle Identity (anon, participant oder admin).
 */
export const meRouter = new Hono<AppEnv>();
meRouter.get('/', (c) => c.json(identitaetAufloesen(c)));
