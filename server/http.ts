import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { z } from 'zod';
import { NotFound } from './db/repo.ts';

/** Einheitliches Fehlerschema { error: { code, message } }. */
export function fehler(c: Context, status: ContentfulStatusCode, code: string, message: string) {
  return c.json({ error: { code, message } }, status);
}

/**
 * Zentrale Fehlerbehandlung (app.onError). Mappt HttpError, ZodError und
 * NotFound auf das einheitliche Fehlerschema; sonst 500.
 */
export function onError(err: Error, c: Context): Response {
  if (err instanceof HttpError) {
    return fehler(c, err.status, err.code, err.message);
  }
  if (err instanceof NotFound) {
    return fehler(c, 404, err.code, err.message);
  }
  if (err instanceof z.ZodError) {
    const msg = err.issues
      .map((i) => `${i.path.join('.') || '(body)'}: ${i.message}`)
      .join('; ');
    return fehler(c, 400, 'validation_error', msg);
  }
  console.error('Unbehandelter Server-Fehler:', err);
  return fehler(c, 500, 'internal_error', 'Interner Serverfehler');
}

/**
 * Liest und validiert den JSON-Body gegen ein zod-Schema. Liefert den
 * geparsten Output-Typ (inkl. angewandter Defaults). Bei ungültigem JSON oder
 * Schema-Verletzung wird ein HttpError (400) geworfen.
 */
export async function jsonBody<S extends z.ZodTypeAny>(
  c: Context,
  schema: S,
): Promise<z.output<S>> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw new HttpError(400, 'invalid_json', 'Ungültiger JSON-Body');
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    const msg = result.error.issues
      .map((i) => `${i.path.join('.') || '(body)'}: ${i.message}`)
      .join('; ');
    throw new HttpError(400, 'validation_error', msg);
  }
  return result.data;
}

/** Strukturierter HTTP-Fehler; in onError zu { error } gemappt. */
export class HttpError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}
