// Muss als ERSTE Import-Zeile in jeder Server-Testdatei stehen (vor Modulen, die
// server/env.ts transitiv laden). ESM wertet Imports in Reihenfolge aus, daher
// setzen die Side-Effects dieser Datei process.env, bevor env.ts validiert.
process.env.SESSION_SECRET ??= 'test-session-secret-mindestens-32-zeichen-lang';
process.env.DATABASE_PATH = ':memory:';
process.env.PUBLIC_BASE_URL ??= 'http://localhost:8787';
