import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';
import { serve } from '@hono/node-server';
import { env } from './env.ts';
import type { AppEnv } from './auth/middleware.ts';
import { authRouter, meRouter } from './routes/auth.ts';
import { tasksRouter } from './routes/tasks.ts';
import { syncRouter } from './routes/sync.ts';
import { adminRouter } from './routes/admin.ts';
import { onError } from './http.ts';
import { getDb } from './db/client.ts';
import { seed } from './db/seed.ts';

// DB öffnen (Migration läuft idempotent in getDb) und Katalog seeden.
getDb();
seed();

const app = new Hono<AppEnv>();

// Einheitliche Fehlerbehandlung ({ error: { code, message } }).
app.onError(onError);

// --- API-Routen ---
app.route('/api/auth', authRouter);
app.route('/api/tasks', tasksRouter);
app.route('/api', syncRouter); // /api/sync, /api/progress
app.route('/api/admin', adminRouter);
app.route('/api/me', meRouter); // GET /api/me → aktuelle Identity

// --- Statische Auslieferung des Vite-Builds (Produktion) ---
const distDir = resolve(process.cwd(), 'dist');
if (existsSync(distDir)) {
  app.use('/*', serveStatic({ root: './dist' }));
  // SPA-Fallback: alles Nicht-API auf index.html
  app.get('/*', (c, next) => {
    if (c.req.path.startsWith('/api/')) return next();
    return serveStatic({ root: './dist', path: 'index.html' })(c, next);
  });
} else {
  console.warn(
    'Kein dist/-Verzeichnis gefunden — statische Auslieferung deaktiviert. ' +
      'Im Dev-Betrieb liefert Vite das Frontend (Port 5173).',
  );
}

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`Server läuft auf http://localhost:${info.port}`);
  if (!env.oidcEnabled) {
    console.log('Hinweis: Admin-Login (OIDC) ist deaktiviert.');
  }
});

export { app };
