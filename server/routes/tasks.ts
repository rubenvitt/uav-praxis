import { Hono } from 'hono';
import type { AppEnv } from '../auth/middleware.ts';
import { requireTeilnehmerOderAdmin } from '../auth/middleware.ts';
import { repo } from '../db/repo.ts';

/** /api/tasks — globaler Aufgabenkatalog (read), genutzt von der Teilnehmer-App. */
export const tasksRouter = new Hono<AppEnv>();

// GET /api/tasks → aktive Tasks, sortiert (participant | admin)
tasksRouter.get('/', requireTeilnehmerOderAdmin, (c) => {
  return c.json(repo.alleTasks(false));
});
