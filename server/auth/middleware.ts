import type { Context, MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import type { Identity } from '../../shared/types.ts';
import { COOKIE_NAME, sessionValidieren } from './sessions.ts';

/** Hono-Context-Erweiterung um die aufgelöste Identität. */
export type AppEnv = {
  Variables: {
    identity: Identity;
  };
};

/** Liest das Session-Cookie und löst die Identität auf (oder anon). */
export function identitaetAufloesen(c: Context<AppEnv>): Identity {
  const token = getCookie(c, COOKIE_NAME);
  if (!token) return { kind: 'anon' };
  return sessionValidieren(token) ?? { kind: 'anon' };
}

/** Liefert die im Context gesetzte Identität (oder anon). */
export function getIdentity(c: Context<AppEnv>): Identity {
  return c.get('identity') ?? { kind: 'anon' };
}

/** Verlangt eine Admin-Session, sonst 401. */
export const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  const identity = identitaetAufloesen(c);
  if (identity.kind !== 'admin') {
    return c.json(
      { error: { code: 'unauthorized', message: 'Admin-Anmeldung erforderlich' } },
      401,
    );
  }
  c.set('identity', identity);
  await next();
};

/** Verlangt eine Teilnehmer-Session, sonst 401. */
export const requireParticipant: MiddlewareHandler<AppEnv> = async (c, next) => {
  const identity = identitaetAufloesen(c);
  if (identity.kind !== 'participant') {
    return c.json(
      { error: { code: 'unauthorized', message: 'Teilnehmer-Anmeldung erforderlich' } },
      401,
    );
  }
  c.set('identity', identity);
  await next();
};

/** Erlaubt Teilnehmer ODER Admin (für /api/tasks). */
export const requireTeilnehmerOderAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  const identity = identitaetAufloesen(c);
  if (identity.kind === 'anon') {
    return c.json(
      { error: { code: 'unauthorized', message: 'Anmeldung erforderlich' } },
      401,
    );
  }
  c.set('identity', identity);
  await next();
};
