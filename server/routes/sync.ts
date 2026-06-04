import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../auth/middleware.ts';
import { getIdentity, requireParticipant } from '../auth/middleware.ts';
import { repo } from '../db/repo.ts';
import { jsonBody } from '../http.ts';

/** /api/sync und /api/progress — Batch-Sync und Fortschritt des Teilnehmers. */
export const syncRouter = new Hono<AppEnv>();

// GET /api/progress → ProgressSnapshot des Teilnehmers
syncRouter.get('/progress', requireParticipant, (c) => {
  const identity = getIdentity(c);
  // requireParticipant garantiert kind === 'participant'
  const id = identity.kind === 'participant' ? identity.id : '';
  return c.json(repo.fortschritt(id));
});

const executionSchema = z.object({
  id: z.string().min(1),
  taskId: z.string().min(1),
  datum: z.string().min(1),
  drohnensteuerer: z.string().default(''),
  luftraumbeobachter: z.string().default(''),
  deletedAt: z.string().nullable().optional(),
});

const taskStatusSchema = z.object({
  taskId: z.string().min(1),
  zielanzahl: z.number().int().nullable(),
  nichtAnwendbar: z.boolean(),
  updatedAt: z.string().min(1),
});

const syncSchema = z.object({
  since: z.string().nullable(),
  executions: z.array(executionSchema),
  taskStatus: z.array(taskStatusSchema),
});

// POST /api/sync → SyncResponse (idempotent). participantId stammt aus der Session.
syncRouter.post('/sync', requireParticipant, async (c) => {
  const identity = getIdentity(c);
  const id = identity.kind === 'participant' ? identity.id : '';
  const req = await jsonBody(c, syncSchema);
  const snapshot = repo.sync(id, req);
  return c.json(snapshot);
});
