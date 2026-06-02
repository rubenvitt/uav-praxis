# Drohnen-Trainingsbegleiter

Offline-fähige Progressive Web App (PWA) zum Praxisleitfaden „Drohnensteuerer BOS". Die App begleitet Trainingseinheiten, erfasst Durchführungen und dokumentiert den Fortschritt pro Aufgabe gemäß dem Leitfaden – geräteübergreifend mit zentralem Kursmanagement.

## Architektur

- **Frontend** (`src/`): React 19 + Vite + TypeScript PWA. Die Teilnehmer-App funktioniert vollständig **offline** (Aufgabenkatalog gecacht, Erfassung lokal in `localStorage`) und synchronisiert automatisch, sobald wieder eine Verbindung besteht.
- **Backend** (`server/`): Node + [Hono](https://hono.dev/) + SQLite (über Node's eingebautes `node:sqlite`). Liefert die REST-API unter `/api/*` und in Produktion zusätzlich den statischen Vite-Build (`dist/`) mit SPA-Fallback. Self-hosted via Docker.
- **Geteilte Typen** (`shared/types.ts`): Quelle der Wahrheit für DTOs, von Frontend und Backend importiert.

### Authentifizierung

- **Admin:** meldet sich über **PocketID (OIDC)** an (`/admin`). Konfiguration über die `OIDC_*`-Variablen. Ist OIDC nicht konfiguriert, ist der Admin-Login deaktiviert (die Teilnehmer-App läuft weiterhin).
- **Teilnehmer:** meldet sich **ohne PocketID** mit einem **persönlichen Dauer-Code** an – per Code-Eingabe unter `/login` oder per **Magic-Link** (`/login?code=XXXX`). Der Admin erzeugt Code und Magic-Link je Teilnehmer und teilt sie manuell.

### Offline-Sync

Schreibvorgänge gehen sofort in den lokalen Zustand **und** in eine Mutations-Queue. Die Sync-Engine schiebt die Queue per `POST /api/sync` (bei App-Start, `online`-Event, nach jeder Mutation debounced, sowie alle 60 s) und übernimmt den autoritativen Server-Snapshot. Executions sind idempotent mergebar (client-UUID); TaskStatus und Tombstones folgen „last-write-wins". Ohne Login läuft die App rein lokal.

## Voraussetzungen

- [Node.js](https://nodejs.org/) **26** oder neuer (für `node:sqlite`)
- [pnpm](https://pnpm.io/)

## Setup

```bash
pnpm install
cp .env.example .env   # Werte anpassen (mindestens SESSION_SECRET; OIDC optional)
```

## Entwicklung

```bash
pnpm dev
```

Startet parallel den Vite-Entwicklungsserver (`http://localhost:5173`) und die API (`tsx watch server/index.ts`, Port 8787). Vite proxyt `/api` auf den API-Server.

## Tests, Lint & Build

```bash
pnpm test    # Vitest einmalig
pnpm lint    # ESLint
pnpm build   # tsc -b && vite build → dist/ (inkl. Service Worker / Offline)
```

## Docker-Deployment

Multi-stage `Dockerfile`: Stage 1 baut das Frontend (`pnpm build` → `dist/`), Stage 2 startet den Hono-Server (`tsx server/index.ts`), der `/api/*` und den statischen Build ausliefert.

```bash
cp .env.example .env   # Produktionswerte setzen (SESSION_SECRET, OIDC_*, PUBLIC_BASE_URL)
docker compose up -d --build
```

Die SQLite-Datenbank wird im Volume `./data` persistiert (`DATABASE_PATH=./data/app.db`). **PocketID** wird als externer/separater Dienst betrieben; ein auskommentiertes Beispiel liegt in `docker-compose.yml`. Nach dem Einrichten von PocketID die `OIDC_*`-Variablen in `.env` setzen.

## Kapitel-Illustrationen

Jede Aufgabe besitzt eine Illustration unter `public/illustrations/<taskId>.webp` (ins Repo committet, damit offline verfügbar). Erzeugt mit [fal.ai](https://fal.ai/), Modell `fal-ai/nano-banana-2`:

```bash
FAL_KEY=… pnpm gen:images               # alle fehlenden Bilder generieren (idempotent)
FAL_KEY=… pnpm gen:images --only 1-1,2-3 # gezielt einzelne Aufgaben
FAL_KEY=… pnpm gen:images --force        # vorhandene neu generieren
FAL_KEY=… pnpm gen:images --resolution 2K
```

Der Basis-Stil liegt in `scripts/illustration-style.ts`, die Motive je Aufgabe in `scripts/illustration-prompts.ts`. Der `FAL_KEY` wird **nie committet** (nur via Env/`.env`, `.env` ist gitignored).

## Konfiguration (Umgebungsvariablen)

| Variable | Beschreibung |
|----------|--------------|
| `PORT` | Port des API-/Produktionsservers (Standard 8787) |
| `PUBLIC_BASE_URL` | Öffentliche Basis-URL (bestimmt u. a. `Secure`-Cookies bei https) |
| `DATABASE_PATH` | Pfad der SQLite-Datei (Standard `./data/app.db`) |
| `SESSION_SECRET` | Geheimnis für Sessions (mind. 32 Byte) |
| `OIDC_ISSUER` | PocketID-Issuer-URL (leer = Admin-Login deaktiviert) |
| `OIDC_CLIENT_ID` | OIDC Client-ID |
| `OIDC_CLIENT_SECRET` | OIDC Client-Secret |
| `OIDC_REDIRECT_URI` | OIDC Callback-URL (`…/api/auth/admin/callback`) |
| `ADMIN_ALLOWLIST` | optional, kommagetrennte E-Mails; leer = jeder PocketID-User |
| `FAL_KEY` | nur für `pnpm gen:images` (Bildgenerierung) |

## Hinweise

- **Zielanzahl pro Aufgabe:** Die `zielanzahlDefault`-Werte sind Schätzungen aus der Transkription des Praxisleitfadens und können pro Aufgabe individuell angepasst werden.
- **App-Icons:** Die Icons unter `public/icons/` sind aus `favicon.svg` konvertiert und können bei Bedarf ersetzt werden.
