# Migration auf TanStack Router + TanStack Query — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Das Routing der App vollständig auf TanStack Router (file-based) umstellen (typsichere Links/Params/Search) und für die Admin-Online-Fläche TanStack Query + Route-Loader einführen — ohne die Teilnehmer-Offline-Schicht anzufassen.

**Architecture:** Zwei Phasen. Phase 1 ersetzt `react-router-dom` durch file-based TanStack Router; die Admin-Komponenten behalten dabei ihr bestehendes `useEffect`-Fetching, die App bleibt grün. Phase 2 zieht für die drei Admin-Routen `queryOptions`-Factories, Route-Loader (`ensureQueryData`) und `useMutation` nach. Auth-Gating bleibt render-seitig in den Layout-Komponenten (kein `beforeLoad`-Redirect), die Teilnehmer-/Anon-Routen nutzen den Router nur fürs Routing/Params.

**Tech Stack:** React 19, Vite 8, Vitest 4, `@tanstack/react-router` + `@tanstack/router-plugin` + `@tanstack/router-cli` (Codegen), `@tanstack/react-query`, `zod` (vorhanden), `pnpm`.

---

## Harte Randbedingung (nicht verhandelbar)

Diese Dateien bleiben **vollständig unangetastet** — keine Imports, keine Signaturen, keine Logik ändern:

- `src/offline/localStore.ts`
- `src/offline/syncEngine.ts`
- `src/hooks/useFortschritt.ts`
- `src/hooks/useKatalog.ts`

Begründung: Der `syncEngine` ist ein batched Push/Pull gegen `/api/sync` mit `since`-Delta und Last-Write-Wins-Queue; TanStack Querys per-Mutation-Offline-Modell würde diese bewährte Korrektheit ohne Gewinn riskieren. Teilnehmer-Routen nutzen TSR fürs Routing/Params, aber **keine Loader**.

## Datei-Struktur

**Neu (Phase 1):**

| Datei | Verantwortung |
|---|---|
| `tsr.config.json` | Codegen-Konfiguration für `tsr generate` (Routen-Verzeichnis, Ausgabedatei, Target). |
| `src/routeTree.gen.ts` | **Generiert** vom Plugin/CLI. Wird committet (s. Task 1, Begründung). |
| `src/router.tsx` | Router-Instanz, globaler `QueryClient`, `Register`-Declaration-Merging. |
| `src/lokal/LokalContext.tsx` | React-Context für den anonymen `lokal`-Übungsmodus (reaktiv, über dem Router). |
| `src/routes/__root.tsx` | Root-Route, typisierter Router-Context (`queryClient` + `auth`). |
| `src/routes/index.tsx` | `/` — Teilnehmer-Dashboard / anon / Zugangsauswahl (Gating via `useAuth`/`useLokal`). |
| `src/routes/aufgabe.$taskId.tsx` | `/aufgabe/$taskId` — Teilnehmer-Aufgabendetail. |
| `src/routes/login.tsx` | `/login` — `validateSearch: { code?: string }`. |
| `src/routes/admin.tsx` | `/admin` — Layout: Auth-Gate + Kopf/Navigation + `<Outlet/>`. |
| `src/routes/admin.index.tsx` | `/admin` (Index) — Redirect auf `/admin/participants`. |
| `src/routes/admin.participants.index.tsx` | `/admin/participants` — Teilnehmer-Übersicht. |
| `src/routes/admin.participants.$participantId.tsx` | `/admin/participants/$participantId` — Teilnehmer-Detail. |
| `src/routes/admin.katalog.tsx` | `/admin/katalog` — Aufgabenkatalog. |
| `src/test/router-utils.tsx` | Test-Helfer: Memory-History-Router aus echtem `routeTree`. |

**Neu (Phase 2):**

| Datei | Verantwortung |
|---|---|
| `src/admin/queries.ts` | `queryOptions`-Factories (`participantsQuery`, `participantDetailQuery(id)`, `adminTasksQuery`). |
| `src/admin/AdminFehler.tsx` | Gemeinsame `errorComponent` für Admin-Routen (nur authentifiziert-aber-fehlgeschlagen). |

**Geändert:** `package.json`, `vite.config.ts`, `eslint.config.js`, `src/App.tsx`, `src/pages/TeilnehmerApp.tsx`, `src/pages/StartPage.tsx`, `src/pages/LoginPage.tsx`, `src/admin/ParticipantsPage.tsx`, `src/admin/ParticipantDetailPage.tsx`, `src/admin/CatalogPage.tsx`, `src/App.test.tsx`, `src/pages/LoginPage.test.tsx`.

**Gelöscht:** `src/admin/AdminApp.tsx` (Layout wandert nach `src/routes/admin.tsx`).

**Unverändert (Routing-relevant, aber kein RR-Import):** `src/main.tsx` (rendert weiterhin nur `<App/>`), `src/admin/AdminLogin.tsx`, `src/components/*`, alle Tests außer den zwei genannten.

---

# PHASE 1 — Router-Migration (RR → TanStack Router)

> Zwischenstand-Hinweis: Während Phase 1 ist die **Test-Suite erst ab Task 6 wieder grün** (file-based Routing ist erst mit vollständigem Route-Baum lauffähig, und `App.test`/`LoginPage.test` werden erst dort umgestellt). Die Tasks 1–5 werden deshalb über **`pnpm gen:routes && pnpm exec tsc -b`** (Typecheck grün) und optional den Dev-Server verifiziert, nicht über `pnpm test`.

## Task 1: Abhängigkeiten, Vite-Plugin & Codegen

**Files:**
- Modify: `package.json` (scripts + deps via pnpm)
- Create: `tsr.config.json`
- Modify: `vite.config.ts:1-12` (Plugin-Import + Plugin-Reihenfolge)
- Modify: `eslint.config.js:9` (`globalIgnores`)

- [ ] **Step 1: Pakete installieren**

```bash
pnpm add @tanstack/react-router @tanstack/react-query
pnpm add -D @tanstack/router-plugin @tanstack/router-cli
```

- [ ] **Step 2: Peer-Kompatibilität prüfen (React 19 / Vite 8)**

Run:
```bash
pnpm ls @tanstack/react-router @tanstack/router-plugin @tanstack/react-query
```
Expected: Installierte Versionen werden gelistet (jeweils `@tanstack/react-router` und `@tanstack/router-plugin` in derselben Major-Linie, `@tanstack/react-query` v5+). Falls `pnpm` Peer-Warnungen zu React 19 oder Vite 8 ausgibt, die Warnung notieren und im Zweifel auf die jeweils neueste Patch-Version aktualisieren. Keine `--force`-Installation.

- [ ] **Step 3: Codegen-Konfiguration anlegen**

Create `tsr.config.json`:
```json
{
  "routesDirectory": "./src/routes",
  "generatedRouteTree": "./src/routeTree.gen.ts",
  "target": "react",
  "semicolons": true,
  "quoteStyle": "single"
}
```

- [ ] **Step 4: Vite-Plugin einhängen (VOR `react()`)**

In `vite.config.ts` den Import ergänzen und das Plugin als **erstes** Plugin eintragen (die Reihenfolge ist wichtig — der Codegen muss vor der React-Transformation laufen):

```ts
/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    tanstackRouter({
      target: 'react',
      routesDirectory: './src/routes',
      generatedRouteTree: './src/routeTree.gen.ts',
    }),
    react(),
    VitePWA({
```

(Rest von `vite.config.ts` unverändert. Dieselbe Datei ist auch die Vitest-Config — das Plugin generiert `routeTree.gen.ts` damit auch bei Testläufen.)

- [ ] **Step 5: Codegen- und Build-Skripte ergänzen**

In `package.json` unter `"scripts"` ergänzen bzw. ändern:
```json
    "gen:routes": "tsr generate",
    "build": "tsr generate && tsc -b && vite build",
```
(`gen:routes` neu hinzufügen; bei `build` das `tsr generate &&` voranstellen, damit `tsc -b` immer einen frischen Route-Baum vorfindet.)

- [ ] **Step 6: Generierte Datei vom ESLint ausnehmen**

In `eslint.config.js` die `globalIgnores`-Zeile erweitern:
```js
  globalIgnores(['dist', 'src/routeTree.gen.ts']),
```

- [ ] **Step 7: Leeres Routen-Verzeichnis + erste Generierung vorbereiten**

> Hinweis: `tsr generate` benötigt mindestens eine Route-Datei mit einer Root-Route. Die eigentliche Generierung erfolgt in Task 2, nachdem `__root.tsx` und `index.tsx` existieren. Hier nur das Verzeichnis anlegen:

```bash
mkdir -p src/routes src/lokal
```

- [ ] **Step 8: Entscheidung `routeTree.gen.ts` committen (dokumentieren)**

Begründung (als Commit-Message-Kontext): `build` ist `tsr generate && tsc -b && vite build` — `tsc -b` und Vitest brauchen die Datei. Wir **committen** `src/routeTree.gen.ts` (kein `.gitignore`-Eintrag), damit Typecheck/Tests/IDE ohne vorherigen Codegen-Schritt funktionieren. Die Datei wird bei jedem `build`/Dev-Start identisch regeneriert; gelegentliche „modified"-Diffs sind erwartbar. ESLint ignoriert sie (Step 6).

- [ ] **Step 9: Commit**

```bash
git add package.json pnpm-lock.yaml tsr.config.json vite.config.ts eslint.config.js
git commit -m "build: TanStack Router/Query-Deps, Vite-Plugin und Codegen-Setup"
```

---

## Task 2: Root-Route, Router-Instanz, Lokal-Context, App-Komposition

**Files:**
- Create: `src/routes/__root.tsx`
- Create: `src/lokal/LokalContext.tsx`
- Create: `src/router.tsx`
- Create: `src/routes/index.tsx`
- Modify: `src/App.tsx` (vollständiger Ersatz)
- Create (generiert): `src/routeTree.gen.ts`

- [ ] **Step 1: Root-Route mit typisiertem Context anlegen**

Create `src/routes/__root.tsx`:
```tsx
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import type { QueryClient } from '@tanstack/react-query';
import type { AuthContextValue } from '../auth/AuthContext';

/**
 * Router-Context: `queryClient` für Admin-Loader (Phase 2), `auth` als typisierter
 * Lese-Zugriff. Wichtig: Das Auth-GATING bleibt render-seitig in den Layout-
 * Komponenten (kein `beforeLoad`-Redirect) — der asynchrone `laden`-Zustand würde
 * sonst kurz die Login-Seite aufblitzen lassen. Die API-Auth ist Cookie-basiert
 * (`credentials: 'include'`) und damit vom React-`auth`-State entkoppelt: Admin-
 * Loader (Phase 2) gelingen schon, während `auth.laden` noch true ist.
 */
export interface RouterContext {
  queryClient: QueryClient;
  auth: AuthContextValue;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: () => <Outlet />,
});
```

- [ ] **Step 2: Reaktiven Lokal-Context anlegen**

Create `src/lokal/LokalContext.tsx`:
```tsx
/* eslint-disable react-refresh/only-export-components --
   Context-Datei: Provider und Hook liegen bewusst zusammen (wie AuthContext).
   Reine Fast-Refresh-DX-Regel. */
import { createContext, useContext, useState, type ReactNode } from 'react';

interface LokalValue {
  /** True, wenn der anonyme lokale Übungsmodus gewählt wurde. */
  lokal: boolean;
  /** Wechselt in den anonymen lokalen Übungsmodus. */
  lokalStarten: () => void;
}

const LokalContext = createContext<LokalValue | null>(null);

/**
 * Hält den `lokal`-Zustand REAKTIV über dem Router. Überlebt Navigation
 * (z. B. /aufgabe/:id und zurück), aber bewusst keinen Reload. Router-Context
 * wäre nicht reaktiv — deshalb ein React-Context-Provider über `RouterProvider`.
 */
export function LokalProvider({ children }: { children: ReactNode }) {
  const [lokal, setLokal] = useState(false);
  return (
    <LokalContext.Provider value={{ lokal, lokalStarten: () => setLokal(true) }}>
      {children}
    </LokalContext.Provider>
  );
}

/** Zugriff auf den Lokal-Modus. Wirft außerhalb von `LokalProvider`. */
export function useLokal(): LokalValue {
  const ctx = useContext(LokalContext);
  if (!ctx) throw new Error('useLokal muss innerhalb von LokalProvider verwendet werden');
  return ctx;
}
```

- [ ] **Step 3: Router-Instanz + Register-Declaration anlegen**

Create `src/router.tsx`:
```tsx
import { createRouter } from '@tanstack/react-router';
import { QueryClient } from '@tanstack/react-query';
import { routeTree } from './routeTree.gen';

/** Globaler Query-Client (Provider in App; zusätzlich in den Router-Context injiziert). */
export const queryClient = new QueryClient();

export const router = createRouter({
  routeTree,
  // Router-eigenen SWR-Cache nicht vor Querys Frische-Logik schalten (Phase 2).
  defaultPreloadStaleTime: 0,
  context: {
    queryClient,
    // `auth` wird zur Laufzeit reaktiv über <RouterProvider context={{ auth }}> gesetzt.
    auth: undefined!,
  },
});

// Einzige nötige Typ-Registrierung der App: macht Link/useNavigate/useSearch/useParams typsicher.
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
```

- [ ] **Step 4: Index-Route anlegen**

Create `src/routes/index.tsx`:
```tsx
import { createFileRoute } from '@tanstack/react-router';
import { useAuth } from '../auth/AuthContext';
import { useLokal } from '../lokal/LokalContext';
import { TeilnehmerApp } from '../pages/TeilnehmerApp';
import { StartPage } from '../pages/StartPage';

export const Route = createFileRoute('/')({
  component: HomeRoute,
});

/**
 * Startseite (/): Teilnehmer-Dashboard, sobald ein Teilnehmer eingeloggt ist oder
 * der anonyme lokale Übungsmodus gewählt wurde; sonst die Zugangsauswahl. Während
 * `/api/me` initial lädt, wird nichts gezeigt, damit für eingeloggte Teilnehmer
 * nicht kurz die Auswahl aufblitzt.
 */
function HomeRoute() {
  const { identity, laden } = useAuth();
  const { lokal, lokalStarten } = useLokal();
  if (identity.kind === 'participant' || lokal) return <TeilnehmerApp />;
  if (laden) return <main className="app" aria-busy="true" />;
  return <StartPage onLokalStart={lokalStarten} />;
}
```

> Hinweis: `TeilnehmerApp` und `StartPage` werden in Task 3 auf den `taskId`-Prop bzw. TSR-`useNavigate` umgestellt. Bis dahin importieren sie noch `react-router-dom`; das ist in Ordnung, da `react-router-dom` noch installiert ist und der Typecheck dieser Route nur die Existenz der Exporte braucht. Wer Tasks strikt sequenziell ausführt, kann Task 3 direkt anschließen, bevor `tsc -b` läuft.

- [ ] **Step 5: App-Komposition vollständig ersetzen**

Replace `src/App.tsx` content entirely:
```tsx
import { useEffect } from 'react';
import { RouterProvider } from '@tanstack/react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { LokalProvider } from './lokal/LokalContext';
import { syncEngine } from './offline/syncEngine';
import { router, queryClient } from './router';

/**
 * Startet die Offline-Sync-Engine ausschließlich für eingeloggte Teilnehmer
 * (§9: anonymer Modus bleibt rein lokal, Admin synchronisiert keinen Fortschritt).
 * `start()` liefert die Stop-Funktion (Cleanup bei Logout / StrictMode-Doppellauf).
 */
function SyncStarter() {
  const { identity } = useAuth();
  useEffect(() => {
    if (identity.kind !== 'participant') return;
    return syncEngine.start();
  }, [identity.kind]);
  return null;
}

/**
 * Rendert den Router und injiziert die LIVE-Identität in den Router-Context
 * (typisierter Lese-Zugriff in Loadern). Muss `useAuth` aufrufen → innerhalb des
 * AuthProvider. Reexport für Tests, damit dort derselbe Pfad mit Memory-History läuft.
 */
export function RouterMitAuth() {
  const auth = useAuth();
  return <RouterProvider router={router} context={{ auth }} />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SyncStarter />
        <LokalProvider>
          <RouterMitAuth />
        </LokalProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 6: Route-Baum generieren und Typecheck**

Run:
```bash
pnpm gen:routes && pnpm exec tsc -b
```
Expected: `src/routeTree.gen.ts` wird erzeugt (enthält Root + `/`). `tsc -b` läuft durch, sobald Task 3 (TeilnehmerApp/StartPage) abgeschlossen ist. Falls Task 3 noch aussteht und Typfehler aus den noch nicht migrierten Navigationsaufrufen kommen: erwartet — direkt mit Task 3 fortfahren.

---

## Task 3: Teilnehmer-Routen + Komponenten-Refactor

**Files:**
- Create: `src/routes/aufgabe.$taskId.tsx`
- Modify: `src/pages/TeilnehmerApp.tsx:1-2,30-77`
- Modify: `src/pages/StartPage.tsx:7,15,40,48`

- [ ] **Step 1: Aufgaben-Detail-Route anlegen**

Create `src/routes/aufgabe.$taskId.tsx`:
```tsx
import { createFileRoute } from '@tanstack/react-router';
import { TeilnehmerApp } from '../pages/TeilnehmerApp';

export const Route = createFileRoute('/aufgabe/$taskId')({
  component: AufgabeRoute,
});

function AufgabeRoute() {
  const { taskId } = Route.useParams();
  return <TeilnehmerApp taskId={taskId} />;
}
```

- [ ] **Step 2: `TeilnehmerApp` auf `taskId`-Prop + TSR-Navigate umstellen**

In `src/pages/TeilnehmerApp.tsx`:

Import-Zeile ersetzen:
```tsx
import { useNavigate } from '@tanstack/react-router';
```
(statt `import { useNavigate, useParams } from 'react-router-dom';`)

Komponenten-Signatur + Params-Logik ersetzen (`useParams` entfällt, `taskId` kommt als Prop):
```tsx
export function TeilnehmerApp({ taskId }: { taskId?: string }) {
  const navigate = useNavigate();
  const aktiv = taskId ?? null;
  const katalog = useKatalog();
```
(Die Zeile `const { taskId } = useParams<{ taskId: string }>();` und `const aktiv = taskId ?? null;` in der alten Form werden dadurch ersetzt.)

Die drei `navigate`-Aufrufe auf die TSR-Objekt-Form umstellen:
```tsx
  // Unbekannte Aufgaben-ID in der URL → zurück zum Dashboard ohne History-Eintrag.
  useEffect(() => {
    if (aktiv && !aufgabe) navigate({ to: '/', replace: true });
  }, [aktiv, aufgabe, navigate]);
```
```tsx
          onBack={() => navigate({ to: '/' })}
```
```tsx
          onSelect={(id) => navigate({ to: '/aufgabe/$taskId', params: { taskId: id } })}
```

- [ ] **Step 3: `StartPage` auf TSR-Navigate umstellen**

In `src/pages/StartPage.tsx`:

Import ersetzen:
```tsx
import { useNavigate } from '@tanstack/react-router';
```
Die beiden Navigationsaufrufe:
```tsx
        <button type="button" className="start-karte" onClick={() => navigate({ to: '/login' })}>
```
```tsx
        <button type="button" className="start-karte" onClick={() => navigate({ to: '/admin' })}>
```

- [ ] **Step 4: Generieren + Typecheck**

Run:
```bash
pnpm gen:routes && pnpm exec tsc -b
```
Expected: `routeTree.gen.ts` enthält jetzt `/` und `/aufgabe/$taskId`. `tsc -b` meldet noch Fehler in `LoginPage.tsx`/`AdminApp.tsx`/`ParticipantsPage.tsx`/`ParticipantDetailPage.tsx` (noch `react-router-dom`) — erwartet, wird in Tasks 4–5 behoben.

---

## Task 4: Login-Route + `validateSearch` + LoginPage-Refactor

**Files:**
- Create: `src/routes/login.tsx`
- Modify: `src/pages/LoginPage.tsx:8-9,17-66` (Search via Prop, TSR-Navigate, kein `replaceState`)
- Test: `src/pages/LoginPage.test.tsx` (wird in Task 6 vollständig umgestellt; der neue `validateSearch`-Test wird hier vorbereitet)

- [ ] **Step 1: Login-Route mit zod-`validateSearch` anlegen**

Create `src/routes/login.tsx`:
```tsx
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { LoginPage } from '../pages/LoginPage';

/**
 * `?code=` typsicher und robust validieren: fehlt/leer ist erlaubt; ein
 * fehlerhaftes Format (z. B. doppeltes `code` → Array) fällt via `.catch` auf
 * `undefined` zurück, statt die Route in einen Fehlerzustand zu zwingen.
 */
const loginSearch = z.object({
  code: z.string().optional().catch(undefined),
});

export const Route = createFileRoute('/login')({
  validateSearch: loginSearch,
  component: LoginRoute,
});

function LoginRoute() {
  const { code } = Route.useSearch();
  return <LoginPage code={code} />;
}
```

- [ ] **Step 2: `LoginPage` auf Prop + TSR-Navigate umstellen**

Vollständiger Ersatz von `src/pages/LoginPage.tsx`:
```tsx
/**
 * Teilnehmer-Login: Code-Eingabe und Magic-Link-Verarbeitung (/login?code=XXXX).
 *
 * - Großes Code-Eingabefeld (Großschreibung, einfache Validierung) → useAuth().loginMitCode.
 * - Magic-Link: erhält `code` typsicher als Prop aus der Route (validateSearch), meldet
 *   automatisch an, entfernt den Code typsicher über den Router aus der URL und leitet
 *   bei Erfolg nach „/". Ungültiger Code → Fehler aus dem AuthContext.
 */
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useAuth } from '../auth/AuthContext';

/** Vereinheitlicht die Code-Darstellung (Großschreibung, ohne Randleerzeichen). */
function codeNormalisieren(roh: string): string {
  return roh.trim().toUpperCase();
}

export function LoginPage({ code: codeAusUrl }: { code?: string }) {
  const { laden, fehler, loginMitCode } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const magicVerarbeitet = useRef(false);

  // Magic-Link: Code aus der URL anmelden, Code typsicher aus der URL entfernen
  // (navigate hält die Router-Location konsistent — KEIN history.replaceState) und
  // bei Erfolg weiterleiten. Der useRef-Wächter verhindert doppeltes Auslösen.
  useEffect(() => {
    if (magicVerarbeitet.current) return;
    if (!codeAusUrl) return;
    magicVerarbeitet.current = true;

    const codeNormalisiert = codeNormalisieren(codeAusUrl);
    void navigate({ to: '/login', search: {}, replace: true });

    void (async () => {
      try {
        await loginMitCode(codeNormalisiert);
        await navigate({ to: '/', replace: true });
      } catch {
        // Fehlermeldung kommt aus dem AuthContext (`fehler`); hier nur schlucken.
      }
    })();
  }, [codeAusUrl, loginMitCode, navigate]);

  const absenden = async (e: FormEvent) => {
    e.preventDefault();
    const eingegeben = codeNormalisieren(code);
    if (!eingegeben) return;
    try {
      await loginMitCode(eingegeben);
      await navigate({ to: '/', replace: true });
    } catch {
      // Fehler steht in `fehler` (aus dem AuthContext) und wird unten angezeigt.
    }
  };

  return (
    <main className="app login">
      <header className="login-kopf">
        <p className="eyebrow">TRAINING · BOS</p>
        <h1>Anmelden</h1>
      </header>

      <p className="login-hinweis">
        Bitte gib deinen persönlichen Code ein. Du hast ihn von deiner Kursleitung erhalten.
      </p>

      <form className="login-form" onSubmit={absenden} noValidate>
        <label htmlFor="login-code">Persönlicher Code</label>
        <input
          id="login-code"
          name="code"
          className="login-code"
          type="text"
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="one-time-code"
          autoCorrect="off"
          spellCheck={false}
          autoFocus
          value={code}
          onChange={(e) => setCode(codeNormalisieren(e.target.value))}
          disabled={laden}
          aria-invalid={fehler ? true : undefined}
          aria-describedby={fehler ? 'login-fehler' : undefined}
          placeholder="z. B. ABCD-1234"
        />

        {fehler && (
          <p id="login-fehler" className="login-fehler" role="alert">
            {fehler}
          </p>
        )}

        <button
          type="submit"
          className="btn-primaer login-button"
          disabled={laden || !code.trim()}
        >
          {laden ? 'Anmelden…' : 'Anmelden'}
        </button>
      </form>
    </main>
  );
}

export default LoginPage;
```

- [ ] **Step 3: Generieren + Typecheck**

Run:
```bash
pnpm gen:routes && pnpm exec tsc -b
```
Expected: `routeTree.gen.ts` enthält jetzt `/login`. Verbleibende Fehler nur noch in `AdminApp.tsx`/`ParticipantsPage.tsx`/`ParticipantDetailPage.tsx` — wird in Task 5 behoben.

---

## Task 5: Admin-Layout + Child-Routen (Phase-1: bestehende Komponenten)

> In Phase 1 behalten die Admin-Komponenten ihr `useEffect`-Fetching (Datenschicht unverändert). Es werden nur die Routing-Importe (`Link`/`useNavigate`/`useParams`) auf TSR umgestellt und die Layout-Komponente aus `AdminApp.tsx` in `routes/admin.tsx` überführt.

**Files:**
- Create: `src/routes/admin.tsx`
- Create: `src/routes/admin.index.tsx`
- Create: `src/routes/admin.participants.index.tsx`
- Create: `src/routes/admin.participants.$participantId.tsx`
- Create: `src/routes/admin.katalog.tsx`
- Delete: `src/admin/AdminApp.tsx`
- Modify: `src/admin/ParticipantsPage.tsx:2,159`
- Modify: `src/admin/ParticipantDetailPage.tsx:2,33-34,105,134`

- [ ] **Step 1: Admin-Layout-Route anlegen (Gating + Outlet)**

Create `src/routes/admin.tsx`:
```tsx
import { createFileRoute, Link, Outlet } from '@tanstack/react-router';
import { useAuth } from '../auth/AuthContext';
import { AdminLogin } from '../admin/AdminLogin';
import '../admin/admin.css';

export const Route = createFileRoute('/admin')({
  component: AdminLayout,
});

/**
 * Admin-Layout: Kopf + Navigation + verschachteltes Routing über <Outlet/>.
 * Login-Gate render-seitig über useAuth (kein beforeLoad-Redirect → kein
 * Aufblitzen der Login-Seite während `laden`). Nur online (kein Offline-Sync).
 */
function AdminLayout() {
  const { identity, laden, logout } = useAuth();

  if (laden) {
    return <div className="admin-laden">Wird geladen …</div>;
  }
  if (identity.kind !== 'admin') {
    return <AdminLogin />;
  }

  return (
    <div className="admin">
      <header className="admin-kopf">
        <div className="admin-titel">
          <p className="eyebrow">Verwaltung</p>
          <h1>Drohnen-Trainingsbegleiter</h1>
        </div>
        <nav className="admin-nav" aria-label="Admin-Navigation">
          <Link to="/admin/participants" activeProps={{ className: 'aktiv' }}>
            Teilnehmer
          </Link>
          <Link to="/admin/katalog" activeProps={{ className: 'aktiv' }}>
            Aufgabenkatalog
          </Link>
        </nav>
        <div className="admin-konto">
          <span>{identity.name ?? identity.email ?? 'Admin'}</span>
          <button type="button" className="btn btn-klein" onClick={() => void logout()}>
            Abmelden
          </button>
        </div>
      </header>

      <main className="admin-inhalt">
        <Outlet />
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Admin-Index-Redirect anlegen**

Create `src/routes/admin.index.tsx`:
```tsx
import { createFileRoute, redirect } from '@tanstack/react-router';

/** Bare /admin → /admin/participants (reiner Routing-Redirect, kein Auth-Gate). */
export const Route = createFileRoute('/admin/')({
  beforeLoad: () => {
    throw redirect({ to: '/admin/participants' });
  },
});
```

- [ ] **Step 3: Admin-Child-Routen anlegen**

Create `src/routes/admin.participants.index.tsx`:
```tsx
import { createFileRoute } from '@tanstack/react-router';
import { ParticipantsPage } from '../admin/ParticipantsPage';

export const Route = createFileRoute('/admin/participants/')({
  component: ParticipantsPage,
});
```

Create `src/routes/admin.participants.$participantId.tsx`:
```tsx
import { createFileRoute } from '@tanstack/react-router';
import { ParticipantDetailPage } from '../admin/ParticipantDetailPage';

export const Route = createFileRoute('/admin/participants/$participantId')({
  component: ParticipantDetailRoute,
});

function ParticipantDetailRoute() {
  const { participantId } = Route.useParams();
  return <ParticipantDetailPage participantId={participantId} />;
}
```

Create `src/routes/admin.katalog.tsx`:
```tsx
import { createFileRoute } from '@tanstack/react-router';
import { CatalogPage } from '../admin/CatalogPage';

export const Route = createFileRoute('/admin/katalog')({
  component: CatalogPage,
});
```

- [ ] **Step 4: `ParticipantsPage` Routing-Importe umstellen**

In `src/admin/ParticipantsPage.tsx` den Import ändern:
```tsx
import { Link } from '@tanstack/react-router';
```
(statt `import { Link } from 'react-router-dom';`)

Und den `Link` in der Tabelle auf typsichere Params umstellen:
```tsx
                      <Link to="/admin/participants/$participantId" params={{ participantId: t.id }}>
                        {t.name}
                      </Link>
```
(ersetzt `<Link to={`/admin/participants/${t.id}`}>{t.name}</Link>`)

- [ ] **Step 5: `ParticipantDetailPage` auf Prop + TSR-Navigate umstellen**

In `src/admin/ParticipantDetailPage.tsx`:

Import ändern (`useParams` entfällt):
```tsx
import { Link, useNavigate } from '@tanstack/react-router';
```

Signatur ändern und `useParams` entfernen:
```tsx
export function ParticipantDetailPage({ participantId }: { participantId: string }) {
  const navigate = useNavigate();
```
(ersetzt `export function ParticipantDetailPage() {` samt `const { participantId } = useParams<{ participantId: string }>();`)

Den Lösch-Navigationsaufruf umstellen:
```tsx
      navigate({ to: '/admin/participants' });
```
(ersetzt `navigate('/admin/participants');`)

Den frühen Guard `if (!participantId) { return <p ...>Kein Teilnehmer ausgewählt.</p>; }` **entfernen** — der Param ist über die Route stets vorhanden. (Der `laden_`-`useCallback` darf das `if (!participantId) return;` intern behalten; es schadet nicht.)

Der Breadcrumb-`Link to="/admin/participants"` bleibt unverändert (TSR-`Link`, kein Param).

- [ ] **Step 6: `AdminApp.tsx` löschen**

```bash
git rm src/admin/AdminApp.tsx
```

- [ ] **Step 7: Generieren + Typecheck**

Run:
```bash
pnpm gen:routes && pnpm exec tsc -b
```
Expected: PASS. `routeTree.gen.ts` enthält jetzt den vollständigen Baum (`/`, `/aufgabe/$taskId`, `/login`, `/admin` mit Index + `participants` + `participants/$participantId` + `katalog`). Keine Typfehler mehr.

---

## Task 6: `react-router-dom` entfernen + Tests umstellen (grün)

**Files:**
- Create: `src/test/router-utils.tsx`
- Modify: `src/App.test.tsx` (vollständiger Ersatz)
- Modify: `src/pages/LoginPage.test.tsx` (vollständiger Ersatz)
- Modify: `package.json` (Dependency entfernen)

- [ ] **Step 1: Test-Helfer für Memory-History-Router anlegen**

Create `src/test/router-utils.tsx`:
```tsx
import {
  createMemoryHistory,
  createRouter,
  type AnyRouter,
} from '@tanstack/react-router';
import { QueryClient } from '@tanstack/react-query';
import { routeTree } from '../routeTree.gen';

/**
 * Baut einen frischen Router auf Memory-History (für Tests) aus dem ECHTEN
 * routeTree. Liefert zusätzlich einen retry-freien QueryClient (Phase 2). Die
 * Auth-Identität wird hier NICHT injiziert — Tests umschließen den Router je nach
 * Bedarf mit echtem `AuthProvider` (App.test) oder gemocktem `useAuth` (LoginPage.test).
 */
export function createTestRouter(initialLocation: string): {
  router: AnyRouter;
  queryClient: QueryClient;
} {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const router = createRouter({
    routeTree,
    defaultPreloadStaleTime: 0,
    history: createMemoryHistory({ initialEntries: [initialLocation] }),
    context: { queryClient, auth: undefined! },
  });
  return { router, queryClient };
}
```

- [ ] **Step 2: `App.test.tsx` auf Memory-History umstellen**

Vollständiger Ersatz von `src/App.test.tsx`:
```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, type AnyRouter } from '@tanstack/react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './auth/AuthContext';
import { LokalProvider } from './lokal/LokalContext';
import { createTestRouter } from './test/router-utils';

beforeEach(() => localStorage.clear());

/**
 * Rendert die App-Komposition (echte Provider) auf einem Memory-History-Router.
 * `api.me()` wird nicht gemockt → schlägt mangels Server fehl → Identität `anon`,
 * useKatalog fällt auf den lokalen Fallback-Katalog zurück.
 */
function renderApp(initial = '/'): AnyRouter {
  const { router, queryClient } = createTestRouter(initial);
  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LokalProvider>
          <RouterProvider router={router} />
        </LokalProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );
  return router;
}

/** App rendern und in den anonymen lokalen Übungsmodus (Dashboard) wechseln. */
async function lokalesDashboardOeffnen(): Promise<AnyRouter> {
  const router = renderApp('/');
  await userEvent.click(await screen.findByRole('button', { name: /Ohne Anmeldung/ }));
  return router;
}

describe('App', () => {
  it('zeigt auf der Startseite die Zugangsauswahl', async () => {
    renderApp('/');
    expect(await screen.findByRole('button', { name: /Teilnehmer/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Verwaltung/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ohne Anmeldung/ })).toBeInTheDocument();
  });

  it('navigiert in die Detailansicht und zurück', async () => {
    await lokalesDashboardOeffnen();
    await userEvent.click(screen.getByText(/Schwebeflug/));
    expect(screen.getByText(/Aufgabe 1\.1/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Übersicht/ }));
    expect(screen.getByText(/Gesamtfortschritt/)).toBeInTheDocument();
  });

  it('spiegelt die geöffnete Aufgabe in der URL und kehrt per Zurück zurück', async () => {
    const router = await lokalesDashboardOeffnen();
    await userEvent.click(screen.getByText(/Schwebeflug/));
    expect(router.state.location.pathname).toMatch(/^\/aufgabe\//);
    await act(async () => {
      router.history.back();
    });
    expect(await screen.findByText(/Gesamtfortschritt/)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
  });

  it('eine erfasste Durchführung erhöht den Zähler nach Rückkehr', async () => {
    await lokalesDashboardOeffnen();
    await userEvent.click(screen.getByText(/Schwebeflug/));
    await userEvent.click(screen.getByRole('button', { name: /hinzufügen/i }));
    await userEvent.click(screen.getByRole('button', { name: /Übersicht/ }));
    await userEvent.click(screen.getByText(/Schwebeflug/));
    expect(screen.getByText(/1 \/ 4/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Test ausführen (App.test)**

Run:
```bash
pnpm exec vitest run src/App.test.tsx
```
Expected: PASS (4 Tests grün).

- [ ] **Step 4: `LoginPage.test.tsx` auf Memory-History + `validateSearch` umstellen**

Vollständiger Ersatz von `src/pages/LoginPage.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider } from '@tanstack/react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import type { AuthContextValue } from '../auth/AuthContext';
import { LokalProvider } from '../lokal/LokalContext';
import { createTestRouter } from '../test/router-utils';

const loginMitCode = vi.fn<AuthContextValue['loginMitCode']>().mockResolvedValue(undefined);
let fehler: string | null = null;
let laden = false;

// useAuth wird gestubbt; loginMitCode ist eine Spy-Funktion. AuthProvider wird in
// diesem Test nicht gebraucht (der Router wird ohne AuthProvider gerendert).
vi.mock('../auth/AuthContext', () => ({
  useAuth: (): AuthContextValue => ({
    identity: { kind: 'anon' },
    laden,
    fehler,
    loginMitCode,
    logout: vi.fn(),
    neuLaden: vi.fn(),
  }),
}));

/** Rendert die echte /login-Route (inkl. validateSearch) auf Memory-History. */
function renderMit(pfad: string) {
  const { router, queryClient } = createTestRouter(pfad);
  return render(
    <QueryClientProvider client={queryClient}>
      <LokalProvider>
        <RouterProvider router={router} />
      </LokalProvider>
    </QueryClientProvider>,
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    loginMitCode.mockClear();
    fehler = null;
    laden = false;
  });

  it('liest den Code aus dem Magic-Link und ruft loginMitCode auf', async () => {
    renderMit('/login?code=TEST123');
    await waitFor(() => expect(loginMitCode).toHaveBeenCalledWith('TEST123'));
  });

  it('normalisiert einen Magic-Link-Code auf Großschreibung', async () => {
    renderMit('/login?code=abcd-1234');
    await waitFor(() => expect(loginMitCode).toHaveBeenCalledWith('ABCD-1234'));
  });

  it('ruft loginMitCode bei manueller Eingabe (großgeschrieben) auf', async () => {
    renderMit('/login');
    await userEvent.type(await screen.findByLabelText(/Persönlicher Code/i), 'mein-code');
    await userEvent.click(screen.getByRole('button', { name: /Anmelden/i }));
    expect(loginMitCode).toHaveBeenCalledWith('MEIN-CODE');
  });

  it('löst ohne Magic-Link-Code keinen Login aus', async () => {
    renderMit('/login');
    await screen.findByLabelText(/Persönlicher Code/i);
    expect(loginMitCode).not.toHaveBeenCalled();
  });

  it('behandelt einen leeren ?code= nicht als Login', async () => {
    renderMit('/login?code=');
    await screen.findByLabelText(/Persönlicher Code/i);
    expect(loginMitCode).not.toHaveBeenCalled();
  });

  it('fängt ein ungültiges (mehrfaches) ?code-Format ab und löst keinen Login aus', async () => {
    // Doppeltes `code` → Array → z.string() schlägt fehl → .catch(undefined) → kein Login.
    renderMit('/login?code=a&code=b');
    await screen.findByLabelText(/Persönlicher Code/i);
    expect(loginMitCode).not.toHaveBeenCalled();
  });

  it('zeigt die Fehlermeldung aus dem AuthContext an', async () => {
    fehler = 'Ungültiger Code';
    renderMit('/login');
    expect(await screen.findByRole('alert')).toHaveTextContent('Ungültiger Code');
  });
});
```

- [ ] **Step 5: Test ausführen (LoginPage.test)**

Run:
```bash
pnpm exec vitest run src/pages/LoginPage.test.tsx
```
Expected: PASS (7 Tests grün).

- [ ] **Step 6: `react-router-dom` entfernen**

```bash
pnpm remove react-router-dom
```

- [ ] **Step 7: Sicherstellen, dass keine RR-Importe übrig sind**

Run:
```bash
grep -rn "react-router-dom" src/ ; echo "exit:$?"
```
Expected: keine Treffer (`exit:1` von grep).

- [ ] **Step 8: Gesamte Suite + Lint grün**

Run:
```bash
pnpm gen:routes && pnpm test && pnpm lint && pnpm exec tsc -b
```
Expected: alle Tests grün, kein Lint-Fehler, Typecheck PASS.

- [ ] **Step 9: Build verifizieren**

Run:
```bash
pnpm build
```
Expected: `tsr generate && tsc -b && vite build` läuft fehlerfrei durch.

- [ ] **Step 10: Commit Phase 1**

```bash
git add -A
git commit -m "feat(routing): Migration auf TanStack Router (file-based), react-router-dom entfernt"
```

---

# PHASE 2 — TanStack Query + Loader (nur Admin-Fläche)

## Task 7: `queryOptions`-Factories

**Files:**
- Create: `src/admin/queries.ts`

- [ ] **Step 1: Query-Factories anlegen**

Create `src/admin/queries.ts`:
```tsx
import { queryOptions } from '@tanstack/react-query';
import { api } from '../api/client';

/** Wiederverwendbare, getippte Query-Einheiten für die Admin-Online-Fläche. */

export const participantsQuery = queryOptions({
  queryKey: ['admin', 'participants'] as const,
  queryFn: () => api.adminGetParticipants(),
});

export const participantDetailQuery = (id: string) =>
  queryOptions({
    queryKey: ['admin', 'participant', id] as const,
    queryFn: () => api.adminGetParticipantDetail(id),
  });

export const adminTasksQuery = queryOptions({
  queryKey: ['admin', 'tasks'] as const,
  queryFn: () => api.adminGetTasks(),
});
```

- [ ] **Step 2: Typecheck**

Run:
```bash
pnpm exec tsc -b
```
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/admin/queries.ts
git commit -m "feat(admin): queryOptions-Factories für Admin-Endpunkte"
```

---

## Task 8: Gemeinsame Admin-Fehlerkomponente

**Files:**
- Create: `src/admin/AdminFehler.tsx`

- [ ] **Step 1: `errorComponent` anlegen**

Create `src/admin/AdminFehler.tsx`:
```tsx
import { ApiError } from '../api/client';

/**
 * errorComponent für Admin-Routen. Greift nur für authentifizierte, aber
 * fehlgeschlagene Loader (500/Netzfehler). Der UNAUTH-Fall erreicht diese
 * Komponente nicht: Das Admin-Layout rendert dann <AdminLogin/> statt <Outlet/>,
 * sodass die fehlerhafte Child-Route gar nicht angezeigt wird.
 */
export function AdminFehler({ error }: { error: Error }) {
  const meldung =
    error instanceof ApiError ? error.message : 'Die Daten konnten nicht geladen werden.';
  return (
    <p className="admin-fehler" role="alert">
      {meldung}
    </p>
  );
}

export default AdminFehler;
```

- [ ] **Step 2: Commit**

```bash
git add src/admin/AdminFehler.tsx
git commit -m "feat(admin): gemeinsame errorComponent für Admin-Routen"
```

---

## Task 9: `ParticipantsPage` auf Query + Loader umstellen

**Files:**
- Modify: `src/routes/admin.participants.index.tsx` (Loader + errorComponent)
- Modify: `src/admin/ParticipantsPage.tsx` (vollständiger Ersatz: `useSuspenseQuery` + `useMutation`)

- [ ] **Step 1: Loader + errorComponent an der Route ergänzen**

Replace `src/routes/admin.participants.index.tsx`:
```tsx
import { createFileRoute } from '@tanstack/react-router';
import { ParticipantsPage } from '../admin/ParticipantsPage';
import { AdminFehler } from '../admin/AdminFehler';
import { participantsQuery } from '../admin/queries';

export const Route = createFileRoute('/admin/participants/')({
  loader: ({ context }) => context.queryClient.ensureQueryData(participantsQuery),
  component: ParticipantsPage,
  errorComponent: AdminFehler,
});
```

- [ ] **Step 2: `ParticipantsPage` auf Query/Mutation umstellen**

Vollständiger Ersatz von `src/admin/ParticipantsPage.tsx`:
```tsx
import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useSuspenseQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../api/client';
import { participantsQuery } from './queries';

function magicLink(loginCode: string): string {
  return `${window.location.origin}/login?code=${encodeURIComponent(loginCode)}`;
}

function formatDatum(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('de-DE');
}

interface NeuZustand {
  name: string;
  beginn: string;
}

const LEER: NeuZustand = { name: '', beginn: '' };

/**
 * Teilnehmer-Übersicht: flache Liste aller Teilnehmer mit Quote, letzter
 * Aktivität und Code/Link zum Kopieren. Daten cache-first über `participantsQuery`
 * (Loader prefetcht → kein Spinner). Anlegen via `useMutation` + invalidate.
 */
export function ParticipantsPage() {
  const queryClient = useQueryClient();
  const { data: zeilen } = useSuspenseQuery(participantsQuery);

  const [neu, setNeu] = useState<NeuZustand>(LEER);
  const [neuOffen, setNeuOffen] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [kopiert, setKopiert] = useState<string | null>(null);

  const anlegenMutation = useMutation({
    mutationFn: (eingabe: { name: string; beginn: string | null }) =>
      api.adminCreateParticipant(eingabe),
    onSuccess: async () => {
      setNeu(LEER);
      setNeuOffen(false);
      setFehler(null);
      await queryClient.invalidateQueries({ queryKey: participantsQuery.queryKey });
    },
    onError: (err) => {
      setFehler(err instanceof ApiError ? err.message : 'Teilnehmer konnte nicht angelegt werden.');
    },
  });

  const anlegen = (e: React.FormEvent) => {
    e.preventDefault();
    if (!neu.name.trim()) return;
    setFehler(null);
    anlegenMutation.mutate({ name: neu.name.trim(), beginn: neu.beginn || null });
  };

  const kopieren = async (text: string, markierung: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        window.prompt('Zum Kopieren markieren:', text);
      }
      setKopiert(markierung);
      window.setTimeout(() => setKopiert((m) => (m === markierung ? null : m)), 1800);
    } catch {
      window.prompt('Zum Kopieren markieren:', text);
    }
  };

  const aktion = anlegenMutation.isPending;

  return (
    <div>
      <div className="admin-sektion-kopf">
        <h2>Teilnehmer</h2>
        <div className="aktionen">
          {zeilen.length > 0 && (
            <a className="btn" href={api.exportUebersichtUrl()} download>
              CSV-Überblick
            </a>
          )}
          <button type="button" className="btn btn-primaer" onClick={() => setNeuOffen((v) => !v)}>
            {neuOffen ? 'Abbrechen' : 'Teilnehmer anlegen'}
          </button>
        </div>
      </div>

      {fehler && (
        <p className="admin-fehler" role="alert">
          {fehler}
        </p>
      )}

      {neuOffen && (
        <form className="karte" onSubmit={anlegen}>
          <h3>Neuer Teilnehmer</h3>
          <div className="feld-reihe" style={{ alignItems: 'flex-end' }}>
            <div className="feld" style={{ flex: '1 1 200px' }}>
              <label htmlFor="tn-name">Name</label>
              <input
                id="tn-name"
                type="text"
                value={neu.name}
                onChange={(e) => setNeu({ ...neu, name: e.target.value })}
                placeholder="Name des Teilnehmers"
                required
              />
            </div>
            <div className="feld">
              <label htmlFor="tn-beginn">Beginn (optional)</label>
              <input
                id="tn-beginn"
                type="date"
                value={neu.beginn}
                onChange={(e) => setNeu({ ...neu, beginn: e.target.value })}
              />
            </div>
            <button type="submit" className="btn btn-primaer" disabled={aktion || !neu.name.trim()}>
              Anlegen
            </button>
          </div>
        </form>
      )}

      {zeilen.length === 0 ? (
        <p className="admin-leer">Noch keine Teilnehmer angelegt.</p>
      ) : (
        <div className="tabelle-umbruch">
          <table className="tabelle">
            <thead>
              <tr>
                <th>Name</th>
                <th>Login-Code</th>
                <th>Magic-Link</th>
                <th>Fortschritt</th>
                <th>Letzte Aktivität</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {zeilen.map(({ participant: t, erledigt, gesamt, quote }) => {
                const prozent = Math.round(quote * 100);
                const link = magicLink(t.loginCode);
                return (
                  <tr key={t.id} className={t.aktiv ? undefined : 'zeile-inaktiv'}>
                    <td>
                      <Link to="/admin/participants/$participantId" params={{ participantId: t.id }}>
                        {t.name}
                      </Link>
                    </td>
                    <td>
                      <div className="code-zelle">
                        <span className="code-wert">{t.loginCode}</span>
                        <button
                          type="button"
                          className="btn btn-klein"
                          onClick={() => void kopieren(t.loginCode, `code-${t.id}`)}
                        >
                          {kopiert === `code-${t.id}` ? 'Kopiert' : 'Kopieren'}
                        </button>
                      </div>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-klein"
                        onClick={() => void kopieren(link, `link-${t.id}`)}
                      >
                        {kopiert === `link-${t.id}` ? 'Kopiert' : 'Link kopieren'}
                      </button>
                    </td>
                    <td>
                      <div className="quote-zelle">
                        <div className="quote-balken">
                          <div className="quote-fuell" style={{ width: `${prozent}%` }} />
                        </div>
                        <span className="quote-zahl">
                          {erledigt}/{gesamt} · {prozent}%
                        </span>
                      </div>
                    </td>
                    <td>{formatDatum(t.lastSeen)}</td>
                    <td>
                      <span className={`badge-status${t.aktiv ? '' : ' inaktiv'}`}>
                        {t.aktiv ? 'aktiv' : 'inaktiv'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default ParticipantsPage;
```

- [ ] **Step 3: Typecheck + Build**

Run:
```bash
pnpm exec tsc -b && pnpm build
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/routes/admin.participants.index.tsx src/admin/ParticipantsPage.tsx
git commit -m "feat(admin): Teilnehmer-Übersicht über Loader + useSuspenseQuery/useMutation"
```

---

## Task 10: `ParticipantDetailPage` auf Query + Loader umstellen

**Files:**
- Modify: `src/routes/admin.participants.$participantId.tsx` (Loader + errorComponent)
- Modify: `src/admin/ParticipantDetailPage.tsx` (vollständiger Ersatz)

- [ ] **Step 1: Loader + errorComponent an der Route ergänzen**

Replace `src/routes/admin.participants.$participantId.tsx`:
```tsx
import { createFileRoute } from '@tanstack/react-router';
import { ParticipantDetailPage } from '../admin/ParticipantDetailPage';
import { AdminFehler } from '../admin/AdminFehler';
import { participantDetailQuery } from '../admin/queries';

export const Route = createFileRoute('/admin/participants/$participantId')({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(participantDetailQuery(params.participantId)),
  component: ParticipantDetailRoute,
  errorComponent: AdminFehler,
});

function ParticipantDetailRoute() {
  const { participantId } = Route.useParams();
  return <ParticipantDetailPage participantId={participantId} />;
}
```

- [ ] **Step 2: `ParticipantDetailPage` auf Query/Mutation umstellen**

Vollständiger Ersatz von `src/admin/ParticipantDetailPage.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useSuspenseQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Teil } from '../../shared/types';
import { api, ApiError, type TeilnehmerPatch } from '../api/client';
import { participantDetailQuery, participantsQuery } from './queries';

function magicLink(loginCode: string): string {
  return `${window.location.origin}/login?code=${encodeURIComponent(loginCode)}`;
}

function formatDatum(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('de-DE');
}

const TEIL_TITEL: Record<Teil, string> = {
  1: 'Teil 1',
  2: 'Teil 2',
  3: 'Teil 3',
};

/** Detail-Auswertung eines Teilnehmers: Quoten je Teil, Aufgaben-Aufschlüsselung,
 * Stammdaten bearbeiten, Code/Link, Detail-CSV-Export. Daten cache-first über
 * `participantDetailQuery` (Loader prefetcht). Mutationen via `useMutation`. */
export function ParticipantDetailPage({ participantId }: { participantId: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: detail } = useSuspenseQuery(participantDetailQuery(participantId));

  const [fehler, setFehler] = useState<string | null>(null);
  const [kopiert, setKopiert] = useState<string | null>(null);

  const [bearbeiten, setBearbeiten] = useState(false);
  const [name, setName] = useState(detail.participant.name);
  const [beginn, setBeginn] = useState(detail.participant.beginn ?? '');
  const [aktiv, setAktiv] = useState(detail.participant.aktiv);

  // Formularfelder mit frischen Server-Daten synchronisieren, wenn die Query neu
  // lädt (z. B. nach „Code neu" oder Invalidate) und gerade nicht bearbeitet wird.
  useEffect(() => {
    if (bearbeiten) return;
    setName(detail.participant.name);
    setBeginn(detail.participant.beginn ?? '');
    setAktiv(detail.participant.aktiv);
  }, [detail, bearbeiten]);

  const detailInvalidieren = () =>
    queryClient.invalidateQueries({
      queryKey: participantDetailQuery(participantId).queryKey,
    });

  const patchMutation = useMutation({
    mutationFn: (patch: TeilnehmerPatch) => api.adminUpdateParticipant(participantId, patch),
    onSuccess: async () => {
      setFehler(null);
      await Promise.all([
        detailInvalidieren(),
        queryClient.invalidateQueries({ queryKey: participantsQuery.queryKey }),
      ]);
    },
    onError: (err) => {
      setFehler(err instanceof ApiError ? err.message : 'Speichern fehlgeschlagen.');
    },
  });

  const loeschenMutation = useMutation({
    mutationFn: () => api.adminDeleteParticipant(participantId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: participantsQuery.queryKey });
      await navigate({ to: '/admin/participants' });
    },
    onError: (err) => {
      setFehler(err instanceof ApiError ? err.message : 'Löschen fehlgeschlagen.');
    },
  });

  const aktion = patchMutation.isPending || loeschenMutation.isPending;

  const speichern = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setFehler(null);
    patchMutation.mutate(
      { name: name.trim(), beginn: beginn || null, aktiv },
      { onSuccess: () => setBearbeiten(false) },
    );
  };

  const codeNeu = () => {
    if (
      !window.confirm(
        `Für „${detail.participant.name}" einen neuen Login-Code erzeugen? Der alte Code wird ungültig.`,
      )
    ) {
      return;
    }
    setFehler(null);
    patchMutation.mutate({ codeNeu: true });
  };

  const loeschen = () => {
    if (
      !window.confirm(
        `Teilnehmer „${detail.participant.name}" und alle Durchführungen wirklich löschen?`,
      )
    ) {
      return;
    }
    setFehler(null);
    loeschenMutation.mutate();
  };

  const kopieren = async (text: string, markierung: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        window.prompt('Zum Kopieren markieren:', text);
      }
      setKopiert(markierung);
      window.setTimeout(() => setKopiert((m) => (m === markierung ? null : m)), 1800);
    } catch {
      window.prompt('Zum Kopieren markieren:', text);
    }
  };

  return (
    <div>
      <p className="admin-pfad">
        <Link to="/admin/participants">Teilnehmer</Link> · {detail.participant.name}
      </p>

      {fehler && (
        <p className="admin-fehler" role="alert">
          {fehler}
        </p>
      )}

      <div className="admin-sektion-kopf">
        <h2>{detail.participant.name}</h2>
        <div className="aktionen">
          <a className="btn" href={api.exportDetailUrl(detail.participant.id)} download>
            Detail-CSV
          </a>
          <button type="button" className="btn" onClick={() => setBearbeiten((v) => !v)}>
            {bearbeiten ? 'Abbrechen' : 'Bearbeiten'}
          </button>
        </div>
      </div>

      {/* Kennzahlen */}
      <div className="karte tn-kopf">
        <div className="tn-kennzahl">
          <span className="tn-kennzahl-wert">{Math.round(detail.quote * 100)}%</span>
          <span className="tn-kennzahl-label">
            {detail.erledigt}/{detail.gesamt} Aufgaben erledigt
          </span>
        </div>
        <dl className="tn-meta">
          <div>
            <dt>Status</dt>
            <dd>
              <span className={`badge-status${detail.participant.aktiv ? '' : ' inaktiv'}`}>
                {detail.participant.aktiv ? 'aktiv' : 'inaktiv'}
              </span>
            </dd>
          </div>
          <div>
            <dt>Beginn</dt>
            <dd>{detail.participant.beginn ?? '—'}</dd>
          </div>
          <div>
            <dt>Letzte Aktivität</dt>
            <dd>{formatDatum(detail.letzteAktivitaet)}</dd>
          </div>
          <div>
            <dt>Login-Code</dt>
            <dd>
              <div className="code-zelle">
                <span className="code-wert">{detail.participant.loginCode}</span>
                <button
                  type="button"
                  className="btn btn-klein"
                  onClick={() => void kopieren(detail.participant.loginCode, 'code')}
                >
                  {kopiert === 'code' ? 'Kopiert' : 'Kopieren'}
                </button>
                <button
                  type="button"
                  className="btn btn-klein"
                  onClick={() => void kopieren(magicLink(detail.participant.loginCode), 'link')}
                >
                  {kopiert === 'link' ? 'Kopiert' : 'Link'}
                </button>
              </div>
            </dd>
          </div>
        </dl>
      </div>

      {bearbeiten && (
        <form className="karte" onSubmit={speichern}>
          <h3>Stammdaten bearbeiten</h3>
          <div className="feld-reihe" style={{ alignItems: 'flex-end' }}>
            <div className="feld" style={{ flex: '1 1 200px' }}>
              <label htmlFor="edit-name">Name</label>
              <input
                id="edit-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="feld">
              <label htmlFor="edit-beginn">Beginn</label>
              <input
                id="edit-beginn"
                type="date"
                value={beginn}
                onChange={(e) => setBeginn(e.target.value)}
              />
            </div>
            <label className="check-zeile">
              <input type="checkbox" checked={aktiv} onChange={(e) => setAktiv(e.target.checked)} />
              aktiv
            </label>
          </div>
          <div className="formular-aktionen">
            <button type="submit" className="btn btn-primaer" disabled={aktion || !name.trim()}>
              Speichern
            </button>
            <button type="button" className="btn" onClick={() => codeNeu()} disabled={aktion}>
              Code neu
            </button>
            <button
              type="button"
              className="btn btn-gefahr"
              onClick={() => loeschen()}
              disabled={aktion}
            >
              Löschen
            </button>
          </div>
        </form>
      )}

      {/* Fortschritt je Teil */}
      {detail.teile.length > 0 && (
        <div className="karte">
          <h3>Fortschritt je Teil</h3>
          <div className="teil-balken-liste">
            {detail.teile.map((s) => (
              <div key={s.teil} className="teil-balken">
                <span className="teil-balken-label">{TEIL_TITEL[s.teil]}</span>
                <div className="quote-balken">
                  <div className="quote-fuell" style={{ width: `${Math.round(s.quote * 100)}%` }} />
                </div>
                <span className="teil-balken-zahl">
                  {s.erledigt}/{s.gesamt} · {Math.round(s.quote * 100)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Aufgaben-Aufschlüsselung */}
      <div className="karte">
        <h3>Aufgaben</h3>
        {detail.aufgaben.length === 0 ? (
          <p className="admin-leer">Keine aktiven Aufgaben im Katalog.</p>
        ) : (
          // Über alle vorhandenen Teile gruppieren (nicht nur die mit anwendbaren
          // Aufgaben) — sonst verschwände ein komplett „nicht anwendbar"-Teil.
          ([1, 2, 3] as Teil[])
            .filter((teil) => detail.aufgaben.some((a) => a.teil === teil))
            .map((teil) => (
              <div key={teil} className="aufgaben-gruppe">
                <h4 className="aufgaben-gruppe-titel">{TEIL_TITEL[teil]}</h4>
                <ul className="aufgaben-liste">
                  {detail.aufgaben
                    .filter((a) => a.teil === teil)
                    .map((a) => (
                      <li
                        key={a.taskId}
                        className={`aufgabe-zeile${a.nichtAnwendbar ? ' nicht-anwendbar' : a.erledigt ? ' erledigt' : ''}`}
                      >
                        <span className="aufgabe-marker" aria-hidden="true">
                          {a.nichtAnwendbar ? '–' : a.erledigt ? '✓' : '✗'}
                        </span>
                        <span className="aufgabe-name">
                          <span className="aufgabe-nummer">{a.nummer}</span> {a.titel}
                        </span>
                        {a.nichtAnwendbar ? (
                          <span className="badge-status inaktiv">nicht anwendbar</span>
                        ) : (
                          <span className="aufgabe-zahl num">
                            {a.anzahl}/{a.ziel}
                          </span>
                        )}
                      </li>
                    ))}
                </ul>
              </div>
            ))
        )}
      </div>
    </div>
  );
}

export default ParticipantDetailPage;
```

- [ ] **Step 3: Typecheck + Build**

Run:
```bash
pnpm exec tsc -b && pnpm build
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/routes/admin.participants.$participantId.tsx src/admin/ParticipantDetailPage.tsx
git commit -m "feat(admin): Teilnehmer-Detail über Loader + useSuspenseQuery/useMutation"
```

---

## Task 11: `CatalogPage` auf Query + Loader umstellen

**Files:**
- Modify: `src/routes/admin.katalog.tsx` (Loader + errorComponent)
- Modify: `src/admin/CatalogPage.tsx` (Datenpfad auf Query/Mutation; Formular-/Editor-Teil unverändert)

- [ ] **Step 1: Loader + errorComponent an der Route ergänzen**

Replace `src/routes/admin.katalog.tsx`:
```tsx
import { createFileRoute } from '@tanstack/react-router';
import { CatalogPage } from '../admin/CatalogPage';
import { AdminFehler } from '../admin/AdminFehler';
import { adminTasksQuery } from '../admin/queries';

export const Route = createFileRoute('/admin/katalog')({
  loader: ({ context }) => context.queryClient.ensureQueryData(adminTasksQuery),
  component: CatalogPage,
  errorComponent: AdminFehler,
});
```

- [ ] **Step 2: `CatalogPage`-Komponente (unterer Teil ab `export function CatalogPage`) auf Query/Mutation umstellen**

In `src/admin/CatalogPage.tsx` bleibt alles oberhalb von `export function CatalogPage()` unverändert (Typen `FormZustand`, `LEER`, `formAusTask`, `eingabeAus`, `ListenEditor`, `TaskFormular`). Nur den Import-Kopf und die `CatalogPage`-Funktion ersetzen.

Import-Kopf ersetzen:
```tsx
import { useState } from 'react';
import { useSuspenseQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { TaskDTO, Teil } from '../../shared/types';
import { api, ApiError, type TaskEingabe } from '../api/client';
import { adminTasksQuery } from './queries';
```
(ersetzt `import { useCallback, useEffect, useState } from 'react';` und `import type { TaskDTO, Teil } ...` / `import { api, ApiError, type TaskEingabe } ...`)

Die `CatalogPage`-Funktion vollständig ersetzen (von `export function CatalogPage() {` bis zum schließenden `}` vor `export default CatalogPage;`):
```tsx
/** Aufgabenkatalog: Voll-CRUD und Reihenfolge (auf/ab). Daten cache-first über
 * `adminTasksQuery` (Loader prefetcht). Mutationen via `useMutation` + invalidate. */
export function CatalogPage() {
  const queryClient = useQueryClient();
  const { data: tasks } = useSuspenseQuery(adminTasksQuery);

  const [fehler, setFehler] = useState<string | null>(null);
  const [neuOffen, setNeuOffen] = useState(false);
  const [neu, setNeu] = useState<FormZustand>(LEER);
  const [bearbeiteId, setBearbeiteId] = useState<string | null>(null);
  const [bearbeite, setBearbeite] = useState<FormZustand>(LEER);

  const tasksInvalidieren = () =>
    queryClient.invalidateQueries({ queryKey: adminTasksQuery.queryKey });

  const anlegenMutation = useMutation({
    mutationFn: (eingabe: TaskEingabe) => api.adminCreateTask(eingabe),
    onSuccess: async () => {
      setNeu(LEER);
      setNeuOffen(false);
      setFehler(null);
      await tasksInvalidieren();
    },
    onError: (err) => {
      setFehler(err instanceof ApiError ? err.message : 'Aufgabe konnte nicht angelegt werden.');
    },
  });

  const speichernMutation = useMutation({
    mutationFn: ({ id, eingabe }: { id: string; eingabe: TaskEingabe }) =>
      api.adminUpdateTask(id, eingabe),
    onSuccess: async () => {
      setBearbeiteId(null);
      setFehler(null);
      await tasksInvalidieren();
    },
    onError: (err) => {
      setFehler(err instanceof ApiError ? err.message : 'Aufgabe konnte nicht gespeichert werden.');
    },
  });

  const loeschenMutation = useMutation({
    mutationFn: (id: string) => api.adminDeleteTask(id),
    onSuccess: async () => {
      setFehler(null);
      await tasksInvalidieren();
    },
    onError: (err) => {
      setFehler(err instanceof ApiError ? err.message : 'Aufgabe konnte nicht gelöscht werden.');
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (ids: string[]) => api.adminReorderTasks(ids),
    onSuccess: async () => {
      setFehler(null);
      await tasksInvalidieren();
    },
    onError: async (err) => {
      setFehler(err instanceof ApiError ? err.message : 'Reihenfolge konnte nicht gespeichert werden.');
      // Optimistischen Cache-Stand verwerfen, autoritative Reihenfolge nachladen.
      await tasksInvalidieren();
    },
  });

  const aktion =
    anlegenMutation.isPending ||
    speichernMutation.isPending ||
    loeschenMutation.isPending ||
    reorderMutation.isPending;

  const anlegen = (e: React.FormEvent) => {
    e.preventDefault();
    setFehler(null);
    anlegenMutation.mutate(eingabeAus(neu));
  };

  const speichern = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bearbeiteId) return;
    setFehler(null);
    speichernMutation.mutate({ id: bearbeiteId, eingabe: eingabeAus(bearbeite) });
  };

  const loeschen = (t: TaskDTO) => {
    if (!window.confirm(`Aufgabe „${t.nummer} ${t.titel}" wirklich löschen?`)) return;
    setFehler(null);
    loeschenMutation.mutate(t.id);
  };

  const verschieben = (index: number, richtung: -1 | 1) => {
    const ziel = index + richtung;
    if (ziel < 0 || ziel >= tasks.length) return;
    const neueReihe = [...tasks];
    const [bewegt] = neueReihe.splice(index, 1);
    neueReihe.splice(ziel, 0, bewegt);
    // Optimistisch im Query-Cache setzen; bei Fehler verwirft onError per invalidate.
    queryClient.setQueryData(adminTasksQuery.queryKey, neueReihe);
    setFehler(null);
    reorderMutation.mutate(neueReihe.map((t) => t.id));
  };

  return (
    <div>
      <div className="admin-sektion-kopf">
        <h2>Aufgabenkatalog</h2>
        <button type="button" className="btn btn-primaer" onClick={() => setNeuOffen((v) => !v)}>
          {neuOffen ? 'Abbrechen' : 'Aufgabe anlegen'}
        </button>
      </div>

      {fehler && (
        <p className="admin-fehler" role="alert">
          {fehler}
        </p>
      )}

      {neuOffen && (
        <TaskFormular
          zustand={neu}
          setZustand={setNeu}
          onSpeichern={anlegen}
          onAbbrechen={() => {
            setNeuOffen(false);
            setNeu(LEER);
          }}
          aktion={aktion}
          titel="Neue Aufgabe"
        />
      )}

      {tasks.length === 0 ? (
        <p className="admin-leer">Noch keine Aufgaben im Katalog.</p>
      ) : (
        <div className="tabelle-umbruch">
          <table className="tabelle">
            <thead>
              <tr>
                <th>Nr.</th>
                <th>Titel</th>
                <th>Teil</th>
                <th>Ziel</th>
                <th>Status</th>
                <th aria-label="Reihenfolge" />
                <th aria-label="Aktionen" />
              </tr>
            </thead>
            <tbody>
              {tasks.map((t, i) =>
                bearbeiteId === t.id ? (
                  <tr key={t.id}>
                    <td colSpan={7}>
                      <TaskFormular
                        zustand={bearbeite}
                        setZustand={setBearbeite}
                        onSpeichern={speichern}
                        onAbbrechen={() => setBearbeiteId(null)}
                        aktion={aktion}
                        titel={`Aufgabe ${t.nummer} bearbeiten`}
                      />
                    </td>
                  </tr>
                ) : (
                  <tr key={t.id} className={t.aktiv ? undefined : 'zeile-inaktiv'}>
                    <td>{t.nummer}</td>
                    <td>{t.titel}</td>
                    <td>{t.teil}</td>
                    <td className="num">{t.zielanzahlDefault}</td>
                    <td>
                      <span className={`badge-status${t.aktiv ? '' : ' inaktiv'}`}>
                        {t.aktiv ? 'aktiv' : 'inaktiv'}
                      </span>
                    </td>
                    <td>
                      <div className="aktionen">
                        <button
                          type="button"
                          className="btn btn-klein"
                          onClick={() => verschieben(i, -1)}
                          disabled={aktion || i === 0}
                          aria-label={`${t.nummer} nach oben`}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="btn btn-klein"
                          onClick={() => verschieben(i, 1)}
                          disabled={aktion || i === tasks.length - 1}
                          aria-label={`${t.nummer} nach unten`}
                        >
                          ↓
                        </button>
                      </div>
                    </td>
                    <td>
                      <div className="aktionen">
                        <button
                          type="button"
                          className="btn btn-klein"
                          onClick={() => {
                            setBearbeiteId(t.id);
                            setBearbeite(formAusTask(t));
                          }}
                          disabled={aktion}
                        >
                          Bearbeiten
                        </button>
                        <button
                          type="button"
                          className="btn btn-klein btn-gefahr"
                          onClick={() => loeschen(t)}
                          disabled={aktion}
                        >
                          Löschen
                        </button>
                      </div>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Typecheck + Build**

Run:
```bash
pnpm exec tsc -b && pnpm build
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/routes/admin.katalog.tsx src/admin/CatalogPage.tsx
git commit -m "feat(admin): Aufgabenkatalog über Loader + useSuspenseQuery/useMutation"
```

---

## Task 12: Verifikation Loader-vs-Gating + Doku

> Dies ist die kritische Verifikation der Phase-2-Annahme: Admin-Loader laufen, aber dank Cookie-Auth ohne Flash; der Unauth-Fall zeigt `AdminLogin` (nicht `errorComponent`).

**Files:**
- Test: `src/admin/AdminGating.test.tsx` (neu)

- [ ] **Step 1: Failing test schreiben (authentifiziert → Liste; unauth → Login)**

Create `src/admin/AdminGating.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { RouterProvider } from '@tanstack/react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import type { Identity, ParticipantProgressDTO } from '../../shared/types';
import { LokalProvider } from '../lokal/LokalContext';
import { createTestRouter } from '../test/router-utils';

const me = vi.fn<() => Promise<Identity>>();
const adminGetParticipants = vi.fn<() => Promise<ParticipantProgressDTO[]>>();

vi.mock('../api/client', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client');
  return {
    ...actual,
    api: {
      ...actual.api,
      me: () => me(),
      adminGetParticipants: () => adminGetParticipants(),
    },
  };
});

// syncEngine nicht real triggern.
vi.mock('../offline/syncEngine', () => ({
  syncEngine: { start: vi.fn(() => () => {}), statusLesen: vi.fn(() => 'online'), abonnieren: vi.fn(() => () => {}) },
}));

import { AuthProvider } from '../auth/AuthContext';

function renderAdmin(initial: string) {
  const { router, queryClient } = createTestRouter(initial);
  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LokalProvider>
          <RouterProvider router={router} />
        </LokalProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

const ADMIN: Identity = { kind: 'admin', id: 'a-1', name: 'Chef', email: null };

beforeEach(() => {
  localStorage.clear();
  me.mockReset();
  adminGetParticipants.mockReset();
});

describe('Admin-Gating + Loader', () => {
  it('zeigt nach Admin-Login die geladene Teilnehmerliste (kein Fehler)', async () => {
    me.mockResolvedValue(ADMIN);
    adminGetParticipants.mockResolvedValue([
      {
        participant: {
          id: 'p-1',
          name: 'Erika Muster',
          loginCode: 'ABCD-1234',
          aktiv: true,
          beginn: null,
          lastSeen: null,
        },
        erledigt: 0,
        gesamt: 10,
        quote: 0,
      },
    ]);
    renderAdmin('/admin/participants');
    expect(await screen.findByText('Erika Muster')).toBeInTheDocument();
    expect(screen.queryByText(/konnten nicht geladen werden|nicht geladen werden/)).toBeNull();
  });

  it('zeigt bei fehlender Admin-Identität die Anmeldung statt eines Fehlers', async () => {
    me.mockResolvedValue({ kind: 'anon' });
    adminGetParticipants.mockRejectedValue(new Error('401'));
    renderAdmin('/admin/participants');
    // Layout rendert AdminLogin (nicht <Outlet/>), der Loader-401 bleibt folgenlos.
    expect(await screen.findByRole('button', { name: /Mit PocketID anmelden/i })).toBeInTheDocument();
    await waitFor(() => expect(me).toHaveBeenCalled());
  });
});
```

- [ ] **Step 2: Test ausführen**

Run:
```bash
pnpm exec vitest run src/admin/AdminGating.test.tsx
```
Expected: PASS (2 Tests). Falls der Unauth-Test fehlschlägt, weil ein Loader-Fehler bis zum Layout durchschlägt: Das wäre ein echter Architektur-Befund — in dem Fall im `errorComponent`-Pfad prüfen und ggf. den Loader-Fehler im Unauth-Fall abfangen. Erwartet ist jedoch PASS, da das Layout bei `kind !== 'admin'` `<AdminLogin/>` statt `<Outlet/>` rendert und der Child-Match damit nicht angezeigt wird.

- [ ] **Step 3: Rationale-Kommentar in `__root.tsx` bereits vorhanden bestätigen**

Verify: Der Kommentar in `src/routes/__root.tsx` (Task 2, Step 1) erklärt die Cookie-Entkopplung. Sicherstellen, dass er noch vorhanden ist; sonst ergänzen.

- [ ] **Step 4: Commit**

```bash
git add src/admin/AdminGating.test.tsx
git commit -m "test(admin): Loader-vs-Gating-Verhalten (authentifiziert/unauth) verifiziert"
```

---

## Task 13: Phase-2-Abschluss — gesamte Suite, Lint, Build

- [ ] **Step 1: Volle Suite + Lint + Typecheck + Build**

Run:
```bash
pnpm gen:routes && pnpm test && pnpm lint && pnpm exec tsc -b && pnpm build
```
Expected: alle Tests grün, kein Lint-Fehler, Typecheck PASS, Build PASS.

- [ ] **Step 2: Manuelle Smoke-Verifikation (Dev-Server)**

Run:
```bash
pnpm dev
```
Expected — im Browser auf `http://localhost:5174` prüfen:
- `/` zeigt Zugangsauswahl (anon); „Ohne Anmeldung üben" → Dashboard; Aufgabe öffnen → URL `/aufgabe/<id>`, Zurück funktioniert.
- `/login?code=XYZ` meldet an und entfernt `?code=` aus der URL.
- `/admin` leitet auf `/admin/participants`; ohne Admin-Session erscheint die PocketID-Anmeldung; mit Session lädt die Teilnehmerliste ohne Spinner-Flackern; Anlegen/Bearbeiten/Löschen/Reorder aktualisieren die Liste; `/admin/katalog` analog.

- [ ] **Step 3: Abschluss-Commit (falls noch offene Änderungen)**

```bash
git add -A
git commit -m "chore: Phase-2-Abschluss — TanStack Query/Loader für Admin grün"
```

---

## Self-Review

**1. Spec-Abdeckung:**
- Ziel 1 (typsichere Links/Navigation): TSR `Link`/`useNavigate` in Tasks 3, 5, 9, 10 → ✅
- Ziel 2 (typsichere Params `taskId`/`participantId`): `Route.useParams()` in Tasks 3, 5 → ✅
- Ziel 3 (validierte Search `?code=`): `validateSearch` zod in Task 4 + Tests in Task 6 → ✅
- Ziel 4 (Loader-basiertes Laden, nur Admin): Tasks 9–11 (`ensureQueryData` + `useSuspenseQuery`) → ✅
- Harte Randbedingung (Offline-Schicht unangetastet): explizit oben + keine Task fasst `localStore`/`syncEngine`/`useFortschritt`/`useKatalog` an → ✅
- file-based Routing + Plugin + Codegen: Task 1 → ✅
- `lokal`-State über dem Router (reaktiv): `LokalContext` Task 2 → ✅
- Auth-Gating in Layouts (kein `beforeLoad`-Redirect): Tasks 2 (Index), 5 (Admin) + Verifikation Task 12 → ✅
- Fehlerbehandlung Admin (`errorComponent`): Task 8 + Tasks 9–11 → ✅
- `routeTree.gen.ts`-Entscheidung: committen, Begründung Task 1 Step 8 → ✅
- Mutationen + `invalidateQueries`: Tasks 9–11 → ✅
- CSV-Export bleibt direkter Link: in Tasks 9/10 unverändert (`exportUebersichtUrl`/`exportDetailUrl`) → ✅
- `react-router-dom` entfernt nach Phase 1: Task 6 Step 6 → ✅
- Tests auf TSR-Setup (`createMemoryHistory` + `RouterProvider` + `QueryClientProvider`): Task 6 → ✅

**2. Placeholder-Scan:** Keine „TBD"/„implement later"/„add error handling"-Platzhalter; alle Code-Schritte enthalten vollständigen Code; alle Commands haben erwartete Ergebnisse.

**3. Typ-Konsistenz:** `RouterContext` (`{ queryClient, auth }`) konsistent in `__root.tsx`, `router.tsx`, `createTestRouter`. Query-Keys konsistent zwischen `queries.ts` und den `invalidateQueries`-Aufrufen (`participantsQuery.queryKey`, `participantDetailQuery(id).queryKey`, `adminTasksQuery.queryKey`). Komponenten-Props konsistent: `TeilnehmerApp({ taskId? })`, `LoginPage({ code? })`, `ParticipantDetailPage({ participantId })`. `TaskEingabe`/`TeilnehmerPatch` aus `api/client` wiederverwendet.

**Offene Punkte zur Laufzeit-Bestätigung (kein Plan-Blocker):**
- Exakte `createFileRoute('…')`-Pfadstrings werden vom Plugin beim Generieren bestätigt/korrigiert; bei Abweichung den vom Plugin erwarteten String übernehmen.
- Peer-Kompatibilität der TanStack-Versionen mit React 19 / Vite 8 (Task 1 Step 2).
