# Spec: Backend (Kursmanagement + Auth) und UI-Redesign

**Datum:** 2026-06-02
**Projekt:** Drohnen-Trainingsbegleiter (vormals „DRK Drohnen-Trainingsbegleiter")
**Status:** Genehmigt — Umsetzung autonom per Workflow

Dieses Dokument ist der **verbindliche Vertrag** für alle Implementierungs-Agenten.
Jeder Agent liest dieses Dokument vollständig, bevor er Code schreibt, und hält sich
exakt an Datenmodell, API-Vertrag, Dateilayout und Designsystem. Bei Unklarheit gilt:
einfachste robuste Variante, bestehende Konventionen der App fortführen.

---

## 1. Ziel & Kontext

Die App ist heute eine offline-fähige React-19-PWA (Vite + TypeScript), die rein
clientseitig den Trainingsfortschritt für den Praxisleitfaden „Drohnensteuerer BOS"
in `localStorage` führt. Aufgaben sind fest in `src/data/tasks.ts` hinterlegt.

Wir ergänzen:

1. **Backend** (Node + Hono + SQLite, self-hosted via Docker) für zentrales
   **Voll-Kursmanagement**: Kurse, Teilnehmer, Aufgabenkatalog (Voll-CRUD) und
   geräteübergreifenden Fortschritt mit Auswertung.
2. **Auth**: Admin meldet sich über **PocketID (OIDC)** an. Teilnehmer melden sich
   **ohne PocketID** mit einem **persönlichen Dauer-Code** an — per Code-Eingabe oder
   per **Magic-Link**, der den Code enthält.
3. **Offline-first + Sync**: Die Teilnehmer-App funktioniert vollständig offline
   (Aufgaben gecacht, Erfassung lokal) und synchronisiert automatisch, sobald wieder
   eine Verbindung besteht.
4. **UI-Redesign** der Teilnehmer-App in Richtung **„A · Offiziell & Ruhig"**: weiß,
   viel Weißraum, **Rot `#e30613` als Akzent**, ruhig und seriös. **Kein DRK-Branding**
   (Wort „DRK" und Logo entfallen). App-Name: **„Drohnen-Trainingsbegleiter"**.

### Getroffene Entscheidungen (aus dem Brainstorming)

| Thema | Entscheidung |
|------|--------------|
| Backend-Zweck | Voll-Kursmanagement (Sync + Monitoring + serverseitiger Katalog) |
| Login-Code | Persönlich & dauerhaft, plus Magic-Link |
| Hosting | Self-hosted via Docker Compose |
| Stack | Node + Hono + SQLite (better-sqlite3) |
| Offline | Offline-first + Sync |
| Struktur | Kurse + Teilnehmer (ein **globaler** Aufgabenkatalog für alle Kurse) |
| Katalog | Voll-CRUD (anlegen/bearbeiten/löschen/sortieren), heutige Aufgaben als Seed |
| Design | Richtung A, Akzent Rot `#e30613`, ohne DRK |

---

## 2. Architektur-Überblick

```
Browser (PWA)
 ├─ Teilnehmer-App  /            (redesignt, offline-first)
 ├─ Login           /login       (Code-Eingabe + Magic-Link /login?code=XXXX)
 └─ Admin           /admin/*     (PocketID-Login, nur online)
        │  fetch /api/* (Cookie-Session)
        ▼
Node-Server (Hono, @hono/node-server)
 ├─ /api/auth/*      PocketID-OIDC (Admin) + Code-Login (Teilnehmer) + Sessions
 ├─ /api/tasks       globaler Aufgabenkatalog (read)
 ├─ /api/sync        Batch-Sync der Teilnehmer-Mutationen (push+pull, idempotent)
 ├─ /api/progress    Fortschritt des eingeloggten Teilnehmers
 ├─ /api/admin/*     Kurse, Teilnehmer, Katalog-CRUD, Kurs-Auswertung
 └─ static           ausgelieferter Vite-Build (Produktion)
        │
        ▼
SQLite-Datei (Volume), better-sqlite3
```

**Single-Repo, ein `package.json`** (kein Workspace) — minimiert Build-Friktion.
Frontend bleibt in `src/`. Backend kommt nach `server/`. Geteilte Typen in
`shared/`. Server läuft via `tsx` (kein separater Server-Build nötig).

---

## 3. Dateilayout (Soll-Zustand)

```
shared/
  types.ts            # geteilte DTOs/Typen (Frontend + Backend importieren von hier)
server/
  index.ts            # Hono-App, Routen-Mount, serveStatic, Server-Start
  env.ts              # Env-Validierung (zod), zentrale Config
  db/
    client.ts         # better-sqlite3-Instanz (Singleton)
    schema.sql        # CREATE TABLE ... (idempotent, IF NOT EXISTS)
    migrate.ts        # führt schema.sql aus + leichte Migrationen
    seed.ts           # importiert AUFGABEN aus src/data/tasks.ts als Katalog-Seed
    repo.ts           # typsichere Query-Helfer (Kurse, Teilnehmer, Tasks, Sync)
  auth/
    sessions.ts       # Session-Erzeugung/-Validierung (DB-backed, httpOnly-Cookie)
    oidc.ts           # PocketID via openid-client (discovery, PKCE, callback)
    participant.ts    # Code-Login: Code -> Session
    middleware.ts     # requireAdmin / requireParticipant Middleware
    codes.ts          # Erzeugung eindeutiger Login-Codes (base32, ohne Ambiguität)
  routes/
    auth.ts           # /api/auth/*
    tasks.ts          # /api/tasks (read), genutzt von Teilnehmer-App
    sync.ts           # /api/sync, /api/progress
    admin.ts          # /api/admin/* (courses, participants, tasks, progress)
  tsconfig.json       # Node-Typen, getrennt von Web-tsconfig
src/
  api/
    client.ts         # fetch-Wrapper (Cookies, Fehlerbehandlung, Typen aus shared)
  auth/
    AuthContext.tsx   # eingeloggte Identität (Teilnehmer|Admin|anon), Login/Logout
  offline/
    localStore.ts     # lokaler Cache + Mutations-Queue (localStorage-basiert)
    syncEngine.ts     # Push/Pull-Sync, Online-Erkennung, Reconciliation
  pages/
    LoginPage.tsx     # Code-Eingabe + Magic-Link-Verarbeitung
    TeilnehmerApp.tsx # bisheriger App-Inhalt (Dashboard/Detail), redesignt
  admin/
    AdminApp.tsx      # Layout + Routing /admin/*
    AdminLogin.tsx    # „Mit PocketID anmelden"
    CoursesPage.tsx   # Kurse-Liste + CRUD
    CourseDetailPage.tsx # Teilnehmer eines Kurses + Fortschritt + Magic-Link/Code
    ParticipantsPanel.tsx # Teilnehmer anlegen/bearbeiten, Code/Link kopieren
    CatalogPage.tsx   # Aufgabenkatalog Voll-CRUD + Reihenfolge
    ProgressPage.tsx  # Auswertung pro Kurs (Tabelle/Export CSV)
  components/         # bestehende, redesignte Komponenten (s. §8)
  design/
    tokens.css        # Designsystem: Variablen (Farben, Spacing, Radius, Schatten, Typo)
  data/tasks.ts       # bleibt (Seed-Quelle + Offline-Fallback)
  App.tsx             # Router (react-router-dom v7)
  main.tsx            # unverändert bis auf Router-Provider falls nötig
Dockerfile
docker-compose.yml
.env.example
```

Bestehende Tests bleiben grün; bestehende Domänen-Module (`src/domain/progress.ts`,
`src/hooks/*`) werden wiederverwendet, nicht gelöscht.

---

## 4. Datenmodell (SQLite)

Alle IDs sind `TEXT` (UUID v4, außer `login_code`). Zeitstempel als ISO-8601-`TEXT`
(UTC). `schema.sql` nutzt `IF NOT EXISTS`.

```sql
-- Admins (identifiziert über PocketID-subject)
CREATE TABLE admins (
  id          TEXT PRIMARY KEY,
  oidc_sub    TEXT UNIQUE NOT NULL,
  email       TEXT,
  name        TEXT,
  created_at  TEXT NOT NULL,
  last_login  TEXT
);

-- Kurse
CREATE TABLE courses (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  beschreibung TEXT,
  beginn      TEXT,              -- ISO yyyy-mm-dd, optional
  archiviert  INTEGER NOT NULL DEFAULT 0,
  created_by  TEXT,              -- admins.id
  created_at  TEXT NOT NULL
);

-- Teilnehmer
CREATE TABLE participants (
  id          TEXT PRIMARY KEY,
  course_id   TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  login_code  TEXT UNIQUE NOT NULL,   -- persönlicher Dauer-Code (base32, 8 Zeichen)
  aktiv       INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL,
  last_seen   TEXT
);

-- Globaler Aufgabenkatalog (Voll-CRUD durch Admin)
CREATE TABLE tasks (
  id                     TEXT PRIMARY KEY,   -- z.B. "1-1" beim Seed, sonst UUID
  teil                   INTEGER NOT NULL,   -- 1 | 2 | 3
  nummer                 TEXT NOT NULL,      -- "1.1"
  titel                  TEXT NOT NULL,
  lernziel               TEXT NOT NULL DEFAULT '',
  schritte               TEXT NOT NULL DEFAULT '[]',  -- JSON string[]
  durchfuehrungshinweise TEXT NOT NULL DEFAULT '[]',  -- JSON string[]
  sicherheitshinweise    TEXT NOT NULL DEFAULT '[]',  -- JSON string[]
  zielanzahl_default     INTEGER NOT NULL DEFAULT 1,
  sort_order             INTEGER NOT NULL DEFAULT 0,
  aktiv                  INTEGER NOT NULL DEFAULT 1,
  updated_at             TEXT NOT NULL
);

-- Durchführungen (eine erfasste Übung eines Teilnehmers zu einer Aufgabe)
CREATE TABLE executions (
  id                TEXT PRIMARY KEY,        -- client-generierte UUID (Idempotenz)
  participant_id    TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  task_id           TEXT NOT NULL,
  datum             TEXT NOT NULL,           -- ISO yyyy-mm-dd
  drohnensteuerer   TEXT NOT NULL DEFAULT '',
  luftraumbeobachter TEXT NOT NULL DEFAULT '',
  created_at        TEXT NOT NULL,
  deleted_at        TEXT                     -- soft delete für Sync-Tombstones
);

-- Pro-Teilnehmer Aufgaben-Einstellungen (Zielanzahl-Override + nicht anwendbar)
CREATE TABLE task_status (
  participant_id  TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  task_id         TEXT NOT NULL,
  zielanzahl      INTEGER,                   -- NULL = Default der Aufgabe nutzen
  nicht_anwendbar INTEGER NOT NULL DEFAULT 0,
  updated_at      TEXT NOT NULL,
  PRIMARY KEY (participant_id, task_id)
);

-- Server-Sessions (Admin + Teilnehmer)
CREATE TABLE sessions (
  token       TEXT PRIMARY KEY,        -- opakes Random-Token (im httpOnly-Cookie)
  kind        TEXT NOT NULL,           -- 'admin' | 'participant'
  subject_id  TEXT NOT NULL,           -- admins.id | participants.id
  created_at  TEXT NOT NULL,
  expires_at  TEXT NOT NULL
);

-- Temporärer OIDC-Login-State (PKCE)
CREATE TABLE oidc_states (
  state          TEXT PRIMARY KEY,
  code_verifier  TEXT NOT NULL,
  nonce          TEXT NOT NULL,
  created_at     TEXT NOT NULL
);
```

**Mapping zur bestehenden Domäne:** `executions` + `task_status` rekonstruieren exakt
das heutige `AufgabenFortschritt` (`zielanzahl`, `durchfuehrungen[]`, `nichtAnwendbar`).
Status „erledigt" wenn Anzahl nicht-gelöschter `executions` ≥ effektive Zielanzahl
(`task_status.zielanzahl ?? tasks.zielanzahl_default`). Logik aus
`src/domain/progress.ts` bleibt maßgeblich und wird wiederverwendet.

---

## 5. Geteilte Typen (`shared/types.ts`)

Quelle der Wahrheit für DTOs. Frontend und Backend importieren von hier.

```ts
export type Teil = 1 | 2 | 3;

export interface TaskDTO {
  id: string;
  teil: Teil;
  nummer: string;
  titel: string;
  lernziel: string;
  schritte: string[];
  durchfuehrungshinweise: string[];
  sicherheitshinweise: string[];
  zielanzahlDefault: number;
  sortOrder: number;
  aktiv: boolean;
}

export interface ExecutionDTO {
  id: string;            // client-UUID
  taskId: string;
  datum: string;         // yyyy-mm-dd
  drohnensteuerer: string;
  luftraumbeobachter: string;
  deletedAt?: string | null;
}

export interface TaskStatusDTO {
  taskId: string;
  zielanzahl: number | null;
  nichtAnwendbar: boolean;
  updatedAt: string;
}

export interface ProgressSnapshot {
  executions: ExecutionDTO[];
  taskStatus: TaskStatusDTO[];
  serverTime: string;
}

// Sync: Client schiebt seit letztem Sync angefallene Mutationen, Server antwortet
// mit autoritativem Snapshot (Pull).
export interface SyncRequest {
  since: string | null;          // letzter erfolgreicher Sync (serverTime) oder null
  executions: ExecutionDTO[];    // Upserts inkl. Tombstones (deletedAt gesetzt)
  taskStatus: TaskStatusDTO[];   // Upserts (last-write-wins via updatedAt)
}
export interface SyncResponse extends ProgressSnapshot {}

export type Identity =
  | { kind: 'anon' }
  | { kind: 'participant'; id: string; name: string; course: { id: string; name: string } }
  | { kind: 'admin'; id: string; name: string | null; email: string | null };

// Admin-DTOs
export interface CourseDTO { id: string; name: string; beschreibung: string | null; beginn: string | null; archiviert: boolean; teilnehmerAnzahl?: number; }
export interface ParticipantDTO { id: string; courseId: string; name: string; loginCode: string; aktiv: boolean; lastSeen: string | null; }
export interface ParticipantProgressDTO { participant: ParticipantDTO; erledigt: number; gesamt: number; quote: number; }
```

---

## 6. API-Vertrag

Alle Endpunkte unter `/api`. Antworten JSON. Auth über httpOnly-Session-Cookie
`sid`. Fehlerschema: `{ "error": { "code": string, "message": string } }` mit
passendem HTTP-Status (400/401/403/404/409/500). Validierung mit **zod**.

### Auth
| Methode | Pfad | Auth | Beschreibung |
|--------|------|------|--------------|
| GET  | `/api/auth/admin/login` | – | Redirect zu PocketID (PKCE, state, nonce) |
| GET  | `/api/auth/admin/callback` | – | OIDC-Callback → Admin-Session, Redirect `/admin` |
| POST | `/api/auth/participant` | – | Body `{ code }` → Teilnehmer-Session. 401 bei ungültig |
| POST | `/api/auth/logout` | beliebig | Session löschen |
| GET  | `/api/me` | beliebig | aktuelle `Identity` |

### Teilnehmer
| Methode | Pfad | Auth | Beschreibung |
|--------|------|------|--------------|
| GET  | `/api/tasks` | participant\|admin | aktive Tasks (Katalog), sortiert |
| GET  | `/api/progress` | participant | `ProgressSnapshot` des Teilnehmers |
| POST | `/api/sync` | participant | `SyncRequest` → `SyncResponse` (idempotent) |

### Admin (`requireAdmin`)
| Methode | Pfad | Beschreibung |
|--------|------|--------------|
| GET    | `/api/admin/courses` | alle Kurse (inkl. teilnehmerAnzahl) |
| POST   | `/api/admin/courses` | Kurs anlegen |
| PATCH  | `/api/admin/courses/:id` | Kurs ändern/archivieren |
| DELETE | `/api/admin/courses/:id` | Kurs löschen (Cascade) |
| GET    | `/api/admin/courses/:id/participants` | Teilnehmer des Kurses |
| GET    | `/api/admin/courses/:id/progress` | `ParticipantProgressDTO[]` |
| GET    | `/api/admin/courses/:id/export` | CSV-Export der Auswertung |
| POST   | `/api/admin/courses/:id/participants` | Teilnehmer anlegen (Code wird erzeugt) |
| PATCH  | `/api/admin/participants/:id` | Teilnehmer ändern (Name, aktiv, Code neu) |
| DELETE | `/api/admin/participants/:id` | Teilnehmer löschen |
| GET    | `/api/admin/tasks` | gesamter Katalog (auch inaktive) |
| POST   | `/api/admin/tasks` | Aufgabe anlegen |
| PATCH  | `/api/admin/tasks/:id` | Aufgabe ändern |
| DELETE | `/api/admin/tasks/:id` | Aufgabe löschen |
| POST   | `/api/admin/tasks/reorder` | Body `{ ids: string[] }` → sort_order |

**Magic-Link:** wird im Frontend gebildet als
`${PUBLIC_BASE_URL}/login?code=<loginCode>`. Der Admin kann je Teilnehmer Code und
Link kopieren. Optional QR-Code-Anzeige (nice-to-have, nur wenn ohne neue
schwergewichtige Dependency umsetzbar — z. B. winzige QR-Lib oder weglassen).

---

## 7. Auth-Flüsse im Detail

### Admin (PocketID / OIDC, `openid-client` v6)
1. `GET /api/auth/admin/login`: Discovery des Issuers (`OIDC_ISSUER`), erzeuge
   `state`, `nonce`, `code_verifier` (PKCE S256), speichere in `oidc_states`,
   redirect zur Authorization-URL.
2. `GET /api/auth/admin/callback?code&state`: lade `oidc_states`, tausche Code gegen
   Tokens, validiere `id_token` (nonce). Lege/aktualisiere `admins` per `oidc_sub`.
   Optional Allowlist: nur E-Mails aus `ADMIN_ALLOWLIST` (kommagetrennt) zulassen,
   sonst 403. Erzeuge Admin-Session, setze Cookie, redirect `/admin`.
3. Logout: Session löschen (kein RP-initiated logout nötig).

### Teilnehmer (Code, ohne PocketID)
1. `POST /api/auth/participant { code }`: normalisiere (uppercase, trim), suche
   aktiven Teilnehmer mit `login_code`. Bei Treffer Session (kind=participant),
   Cookie setzen, `last_seen` aktualisieren. Sonst 401. Rate-Limit (einfacher
   In-Memory-Zähler pro IP, z. B. 10/min) gegen Code-Bruteforce.
2. **Magic-Link** `/login?code=XXXX`: `LoginPage` liest `code` aus Query, ruft
   automatisch `POST /api/auth/participant` auf, entfernt den Code aus der URL
   (`history.replaceState`) und leitet bei Erfolg zur App weiter.

### Sessions
- Token: 32 Byte Random, base64url. Cookie `sid`: `HttpOnly`, `SameSite=Lax`,
  `Path=/`, `Secure` wenn `PUBLIC_BASE_URL` https. Laufzeit: Teilnehmer 180 Tage
  (Dauer-Charakter), Admin 7 Tage. Sliding renewal optional.
- `requireParticipant` / `requireAdmin` Middleware lesen Cookie, prüfen `sessions`,
  hängen Identität an den Hono-Context (`c.set('identity', ...)`).

---

## 8. Frontend-Redesign (Richtung A) & Designsystem

**Stimmung:** offiziell, ruhig, viel Weißraum, Rot nur als Akzent. Mobile-first,
große Touch-Ziele (min. 44px). Kein DRK-Wort/-Logo.

`src/design/tokens.css` (von `main.tsx` importiert, ergänzt/ersetzt `styles.css`):

```css
:root {
  --akzent: #e30613;          /* Rot, nur Akzent */
  --akzent-weich: #fff5f5;
  --text: #16181d;
  --text-leise: #6b7280;
  --text-zart: #9aa0a6;
  --linie: #ececec;
  --flaeche: #ffffff;
  --flaeche-2: #f7f8f9;
  --erfolg: #16a34a;
  --warnung: #d97706;
  --radius: 14px;
  --radius-s: 10px;
  --schatten: 0 1px 2px rgba(0,0,0,.04), 0 4px 16px rgba(0,0,0,.05);
  --space: 16px;
  --font: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
```

**Layout-Vorgaben** (entsprechen dem genehmigten Mockup):
- Kopf: kleine Eyebrow-Zeile (`TRAINING · BOS`, in Akzentrot, gesperrt, uppercase),
  darunter App-Titel fett.
- Fortschritts-Karte: große Prozentzahl (~2.1rem, fett), Subzeile
  „Gesamtfortschritt · N von M Aufgaben", schlanke Progress-Bar (8–9px, Akzentrot).
- Abschnitte je Teil mit kleiner Uppercase-Sektionsüberschrift (in `--text-zart`).
- Aufgaben-Zeilen: 1px-Rahmen `--linie`, Radius, Nummer in Akzentrot fett (Breite
  fix), Titel, rechts Badge. Badge „erledigt" = Akzentrot gefüllt/weiß; sonst
  „x / y" in `--flaeche-2`. „nicht anwendbar" dezent ausgegraut.
- Detailseite, `DurchfuehrungForm`, Warnhinweise und Speicher-Warnbanner im gleichen
  System überarbeiten (ruhig, klare Typo, 44px-Eingaben/Buttons).
- Online/Offline- und Sync-Status dezent anzeigen (z. B. kleiner Indikator: „Offline —
  Änderungen werden gespeichert" / „Synchronisiert").

Bestehende Komponenten (`Dashboard`, `TaskCard`, `TaskDetail`, `DurchfuehrungForm`)
werden **umgestaltet, nicht ersetzt** — gleiche Props/Verhalten, neues Markup/CSS.
Bestehende Komponenten-Tests müssen weiter passen (ggf. an geändertes Markup
anpassen, ohne Verhalten zu verändern).

---

## 9. Offline-first & Sync (Frontend)

- **Lokaler Cache** (`src/offline/localStore.ts`, localStorage):
  - `tasks` (zuletzt geladener Katalog; Offline-Fallback ist `src/data/tasks.ts`),
  - lokaler Fortschritt im bestehenden Format (`AufgabenFortschritt`-Map),
  - **Mutations-Queue**: Liste noch nicht synchronisierter Änderungen
    (Execution-Upserts/Tombstones, TaskStatus-Upserts), jeweils mit `updatedAt`.
  - `lastSync` (serverTime des letzten erfolgreichen Pull).
- **`useFortschritt` erweitern/umhüllen:** Schreibvorgänge gehen weiter sofort in den
  lokalen Zustand (sofortige UI-Reaktion) **und** in die Queue. Keine Änderung der
  bestehenden öffentlichen Hook-API, damit Komponenten/Tests stabil bleiben.
- **`syncEngine.ts`:**
  - Trigger: App-Start (online), `online`-Event, nach jeder Mutation (debounced ~2s),
    Intervall (~60s).
  - Ablauf: `POST /api/sync` mit `{ since: lastSync, executions, taskStatus }`.
    Server wendet Upserts idempotent an (Execution-PK = client-UUID; Tombstones via
    `deletedAt`; TaskStatus last-write-wins per `updatedAt`) und liefert autoritativen
    `ProgressSnapshot` zurück. Client ersetzt lokalen Fortschritt durch Merge des
    Snapshots, leert bestätigte Queue-Einträge, setzt `lastSync = serverTime`.
  - **Konfliktregel:** Executions sind additiv/mergebar (eindeutige IDs). TaskStatus &
    Tombstones: last-write-wins per `updatedAt`. Einfach und ausreichend.
  - Fehlertoleranz: bei Netzfehler still bleiben, Queue behalten, später erneut.
- **Anonymer Modus:** Ohne Login funktioniert die App wie bisher rein lokal
  (kein Sync). Nach Teilnehmer-Login wird der lokale Fortschritt einmalig in die Queue
  übernommen und hochgeladen (Merge mit Server).

---

## 10. Konfiguration (`.env.example`)

```
PORT=8787
PUBLIC_BASE_URL=http://localhost:8787
DATABASE_PATH=./data/app.db
SESSION_SECRET=change-me-please-min-32-bytes
OIDC_ISSUER=https://pocket-id.example.org
OIDC_CLIENT_ID=drohnen-trainingsbegleiter
OIDC_CLIENT_SECRET=change-me
OIDC_REDIRECT_URI=http://localhost:8787/api/auth/admin/callback
ADMIN_ALLOWLIST=            # optional, kommagetrennte E-Mails; leer = jeder PocketID-User
```

`server/env.ts` validiert mit zod und bricht beim Start mit klarer Meldung ab, wenn
Pflichtwerte fehlen (OIDC darf im reinen Teilnehmer-/Dev-Betrieb optional sein:
Admin-Login dann deaktiviert mit Hinweis).

---

## 11. Deployment (Docker)

- **`Dockerfile`** (multi-stage): Stage 1 baut Frontend (`pnpm build` → `dist/`).
  Stage 2 Node-Slim, installiert Prod-Deps + `tsx`, kopiert `server/`, `shared/`,
  `src/data/tasks.ts` (für Seed), `dist/`. `CMD ["tsx","server/index.ts"]`.
  Server liefert `/api/*` und statisch `dist/` aus (SPA-Fallback auf `index.html`).
- **`docker-compose.yml`**: Service `app` (Build, Ports, Volume `./data:/app/data`,
  `env_file: .env`). PocketID wird als **extern/separat** dokumentiert (auskommentierter
  Beispiel-Service im Compose + Hinweis im README), nicht zwingend mitgestartet.
- Dev: `pnpm dev` startet Vite (5173) und API (`tsx watch server/index.ts`, 8787)
  parallel (via `concurrently`); Vite-Proxy `/api` → `http://localhost:8787`.

---

## 12. Tests & Qualität

- Bestehende Vitest-Tests bleiben grün.
- Backend: leichte Integrationstests für Sync-Idempotenz (zweimal dasselbe
  `SyncRequest` → keine Duplikate), Code-Login (gültig/ungültig), Auth-Middleware,
  Progress-Berechnung (gegen `src/domain/progress.ts`). In-Memory-SQLite (`:memory:`).
- Frontend: Tests für `localStore`/`syncEngine` (Queue, Merge), `LoginPage`
  (Magic-Link liest Code), angepasste Komponenten-Tests.
- **Akzeptanz:** `pnpm install`, `pnpm build` (tsc + vite) und `pnpm test` laufen
  fehlerfrei. `pnpm lint` ohne neue Fehler. App startet lokal (`pnpm dev`),
  Teilnehmer-Login per Code und Magic-Link funktioniert, Offline-Erfassung + Sync
  funktioniert, Admin-Bereich erreichbar (PocketID-Flow konfigurierbar).

---

## 13. Umsetzungsreihenfolge (für den Workflow)

1. **Fundament**: Dependencies + Scripts (package.json), `shared/types.ts`,
   `server/tsconfig.json`, `src/design/tokens.css`, Vite-Proxy, Router-Gerüst in
   `App.tsx`. Liefert ein stabiles Skelett, das alle weiteren Agenten nutzen.
2. **Backend** (parallel, disjunkte Dateien): DB (schema/migrate/seed/repo) ·
   Auth (sessions/oidc/participant/middleware/codes) · Routes (auth/tasks/sync/admin).
3. **Backend-Build-Check** (sequenziell): `tsx`/tsc-Typecheck des Servers, Smoke-Test.
4. **Frontend** (parallel, disjunkte Dateien): Redesign Teilnehmer-Komponenten +
   Designsystem · Auth/Login-UI + AuthContext + api/client · Admin-UI · Offline/Sync.
5. **Integration** (sequenziell): App.tsx-Routing verdrahten, main.tsx, Docker,
   `.env.example`, README aktualisieren.
6. **Build & Test Fixer** (sequenziell, iterativ): `pnpm install && pnpm build &&
   pnpm test && pnpm lint` bis grün; Fehler beheben.
7. **Review** (parallel) auf Auth/Sync/Sicherheit; Fixer wendet bestätigte Findings an.

Jeder Agent: dieses Spec-Dokument zuerst vollständig lesen, nur Dateien im
zugewiesenen Bereich anlegen/ändern, Sprache der App bleibt Deutsch (Bezeichner/Texte
wie bestehend), bestehende Code-Konventionen fortführen.

---

## 14. Kapitel-Illustrationen (fal.ai · nano-banana-2)

Jede Aufgabe („Kapitel") erhält **ein illustratives Bild im einheitlichen Stil**, das
die Übung verdeutlicht und grob zeigt, was zu tun ist (z. B. Flugbahn der „Liegenden
Acht"). Erzeugt mit **fal.ai**, Modell **`fal-ai/nano-banana-2`** (HTTP-API
`https://fal.run/fal-ai/nano-banana-2`, Auth-Header `Authorization: Key $FAL_KEY`,
~$0.08/Bild bei 1K).

**Speicherung & Auslieferung:** Bilder werden nach `public/illustrations/<taskId>.webp`
(bzw. `.png`) gespeichert und **ins Repo committet**, damit sie offline verfügbar sind
(PWA-Cache). Das `tasks`-Schema erhält Spalte `bild TEXT` (relativer Pfad, nullable);
`TaskDTO` erhält `bildUrl?: string | null`. Seed setzt `bild` auf den Pfad, sofern das
Bild existiert. In `TaskDetail` wird das Bild oben dezent eingebunden (gerundete Ecken,
`--linie`-Rahmen, `loading="lazy"`, Alt-Text = Titel + Kurzbeschreibung).

**Basis-Prompt (Stil, gilt für ALLE Kapitel — konstant für Konsistenz):** in
`scripts/illustration-style.ts` als `BASIS_PROMPT` exportiert. Pro Aufgabe wird der
maneuverspezifische Teil aus `scripts/illustration-prompts.ts` (Map `taskId -> Motiv`)
angehängt. Stilrichtung passend zu Design „A" (final beim Generieren bestätigt):
sauber, ruhig, instruktiv, weißer/heller Hintergrund, **ein roter Akzent `#e30613`**,
klare Flugbahn-Linien/Pfeile, eine kompakte Drohne, optional Pilot mit Fernsteuerung,
keine Markenlogos, kein Text im Bild, einheitlicher Bildausschnitt (`aspect_ratio` z. B.
`4:3`).

**Generierungs-Skript** `scripts/generate-illustrations.ts` (Node/tsx):
- liest `FAL_KEY` aus der Umgebung (Abbruch mit klarer Meldung, wenn fehlt),
- iteriert über alle Aufgaben aus `src/data/tasks.ts`, baut `BASIS_PROMPT + Motiv`,
- ruft die fal-API auf (`@fal-ai/client` oder direkter `fetch` auf `fal.run`),
- lädt das Ergebnis-Bild herunter, speichert nach `public/illustrations/<taskId>.webp`,
- ist **idempotent** (überspringt vorhandene Dateien, `--force` zum Neugenerieren),
- `--only <taskId,...>` für gezielte (Test-)Generierung, `--resolution 1K|2K`.
- npm-Script: `"gen:images": "tsx scripts/generate-illustrations.ts"`.

Der Key wird **nie committet** (nur via Env/`.env`, `.env` ist gitignored).

## 15. Nicht im Scope (YAGNI)

- Mehrere Admin-Rollen/Rechtestufen (ein Admin-Typ genügt).
- Kurs-individuelle Aufgabenkataloge (Katalog ist global).
- Echtzeit-Sync/WebSockets (Batch-Sync genügt).
- E-Mail-Versand der Magic-Links (Admin kopiert/teilt manuell).
- Passwort-Login für Teilnehmer (nur Code/Link).
