# Design: Migration auf TanStack Router + TanStack Query

**Datum:** 2026-06-04
**Status:** Freigegeben (Brainstorming abgeschlossen)
**Branch:** `feat/tanstack-router-query-migration`

## Motivation

Ziel ist bessere DX/Typsicherheit im Routing, unabhängig vom (bereits behobenen)
Service-Worker-Login-Bug. Konkret gewünscht:

1. Typsichere Links/Navigation (keine String-Pfade)
2. Typsichere Route-Params (`taskId`, `participantId`)
3. Validierte Search-Params (`?code=` in `/login`)
4. Loader-basiertes Daten-Laden

Heutiger Stand: `react-router-dom` v7 im klassischen `<BrowserRouter><Routes>`-Stil
(~8 Routen), Daten über Custom-Hooks. Keine `TanStack Query`.

## Geltungsbereich & harte Randbedingung

- **Routing komplett** auf TanStack Router (TSR) → Ziele 1–3 (reine *Router*-Features,
  unabhängig von Query).
- **TanStack Query + Loader nur für die Admin-Online-Fläche** → Ziel 4 dort, wo es
  idiomatisch passt.
- **Harte Randbedingung (nicht verhandelbar):** Die Teilnehmer-Offline-Schicht
  (`src/offline/localStore.ts`, `src/offline/syncEngine.ts`, `src/hooks/useFortschritt.ts`,
  `src/hooks/useKatalog.ts`) bleibt **unangetastet**.

  Begründung: `syncEngine` ist ein *batched* Push/Pull gegen einen einzigen
  `/api/sync`-Endpunkt mit `since`-Delta, server-autoritativer Reconciliation,
  coalescing Last-Write-Wins-Queue und Pending-Overlay-Merge (damit in-flight lokale
  Mutationen nicht aus der UI flackern). TanStack Querys Offline-Modell ist
  *per-Mutation* Pause/Resume über einzelne Endpunkte. Diese Engine auf Query zu
  heben würde entweder das Batch-Delta-Modell aufgeben oder die ganze Engine als
  opaken „Mutation"-Block kapseln — beides riskiert bewährte Offline-Korrektheit
  ohne Gewinn. Teilnehmer-Routen nutzen TSR fürs Routing/Params, aber **keine
  Loader**; Daten bleiben cache-first über die bestehenden Hooks.

## Architektur

### Routing (file-based)

File-based Routing mit dem `@tanstack/router-plugin` für Vite (beste
Typgenerierung — primäres DX-Ziel). Route-Baum:

| Route | Datei (Konvention) | Params | Bemerkung |
|---|---|---|---|
| `/` | `routes/index.tsx` | — | Teilnehmer-Dashboard / anon / Zugangsauswahl |
| `/aufgabe/$taskId` | `routes/aufgabe.$taskId.tsx` | `taskId` | Teilnehmer-Aufgabendetail |
| `/login` | `routes/login.tsx` | — | `validateSearch: { code?: string }` |
| `/admin` | `routes/admin.tsx` (Layout) | — | Auth-Gate + Kopf/Navigation |
| `/admin/participants` | `routes/admin.participants.index.tsx` | — | Loader |
| `/admin/participants/$participantId` | `routes/admin.participants.$participantId.tsx` | `participantId` | Loader |
| `/admin/katalog` | `routes/admin.katalog.tsx` | — | Loader |

Generiertes `routeTree.gen.ts` (vom Plugin) wird via `.gitignore`-Entscheidung im
Plan geklärt; Typsicherheit über Declaration-Merging (`Register`-Interface).

Der App-State `lokal` (anonymer Übungsmodus, überlebt Navigation, nicht Reload)
wandert in den Root-Route-Context bzw. einen schlanken Provider über dem Router,
damit er nicht beim Routenwechsel verfällt (heute via State über `<Routes>`).

### Search-Param-Validierung

`/login` erhält `validateSearch` mit zod-Schema `{ code: z.string().optional() }`,
typisiert gelesen via `Route.useSearch()`. Ersetzt `useSearchParams().get('code')`
samt Null-Checks in `LoginPage`.

### Datenschicht-Split

**Admin (online-only):**
- Ein globaler `QueryClient` (Provider über dem Router; Client zusätzlich in den
  Router-Context injiziert).
- Pro Admin-Route ein `loader`, der `queryClient.ensureQueryData(<queryOptions>)`
  prefetcht; Komponenten lesen via `useSuspenseQuery`/`useQuery`.
- `queryOptions`-Factories pro Endpunkt (`participantsQuery`, `participantDetailQuery(id)`,
  `adminTasksQuery`) als wiederverwendbare, getippte Einheiten.
- Mutationen (Teilnehmer/Tasks anlegen/ändern/löschen, Reorder) als `useMutation`
  mit gezieltem `invalidateQueries`.
- CSV-Export bleibt direkter Link (`api.exportDetailUrl`/`exportUebersichtUrl`).

**Teilnehmer/Anon (offline-first):**
- Unverändert: `useKatalog`/`useFortschritt`/`syncEngine`. Kein Loader, instant
  render bleibt, Fehler werden weiterhin bewusst verschluckt.

### Auth-Gating

`AuthContext` bleibt **die reaktive Quelle der Wahrheit** (Login/Logout/`laden`
brauchen Reaktivität in der UI; `useAuthOptional` hält Hooks testbar ohne Provider).
Identität wird zusätzlich in den **Router-Context** injiziert (typisierter Zugriff).

Das **Gating bleibt in den Layout-Komponenten** (kein `beforeLoad`-Redirect):
- `/` (Root/Index): `laden` → leerer Busy-State; `participant`/`lokal` → Dashboard;
  sonst Zugangsauswahl. (Wie heute `HomeRoute`.)
- `/admin` (Layout): `laden` → Ladeanzeige; `kind !== 'admin'` → `AdminLogin`;
  sonst Admin-Shell + `<Outlet/>`.

Grund: Der asynchrone `laden`-Zustand würde bei `beforeLoad`-Redirect kurz die
Login-Seite aufblitzen lassen — die „kein Flackern"-UX ist Absicht. Admin-Loader
laufen erst im bereits authentifizierten Subtree.

## Fehlerbehandlung

- Admin-Loader/Queries: TSR `errorComponent` pro Admin-Route bzw. Query-`error`-State
  → sichtbare Fehlermeldung (online-only, hier sind Spinner/Fehler erwünscht).
- Teilnehmer-Pfad: unverändert (keine Fehler-UI, cache-first).
- `ApiError` (Status 0 = offline) bleibt das einheitliche Fehlerschema des Clients.

## Tests

- Bestehende Tests mit react-router (`App.test`, `AdminLogin.test`,
  `uebernahme.test`, …) auf TSR-Test-Setup umstellen: `createMemoryHistory` +
  `RouterProvider`, plus `QueryClientProvider` (mit retry-freiem Test-Client).
- Offline-/Domain-Tests (`useFortschritt`, sync-nahe) bleiben unberührt, da die
  Schicht nicht angefasst wird.
- Neuer Test: `validateSearch` für `/login?code=` (gültig/ungültig/leer).

## Phasing (Detail im Implementierungsplan)

Zwei Phasen, damit die App nie kaputt mittendrin ist:

1. **Router-Migration komplett:** RR → TSR, alle `useNavigate`/`Link`/`NavLink`/
   `useParams`/`useSearchParams` umstellen, file-based Route-Baum, `lokal`-State
   verlagern, `react-router-dom` entfernen. App läuft mit **unveränderter**
   Datenschicht. Tests grün.
2. **TanStack Query + Loader** für die Admin-Fläche nachziehen: `QueryClient`,
   `queryOptions`, Route-Loader, `useMutation`-Umstellung der Admin-Mutationen.

## Abhängigkeiten

Neu:
- `@tanstack/react-router`
- `@tanstack/router-plugin` (Vite, file-based + Codegen)
- `@tanstack/react-query`
- Devtools (`@tanstack/router-devtools`, `@tanstack/react-query-devtools`) — dev-only, optional

Vorhanden: `zod` (für `validateSearch`).
Entfernt nach Phase 1: `react-router-dom`.

## Nicht im Geltungsbereich (YAGNI)

- Kein Umbau der Teilnehmer-Offline-Engine auf Query (harte Randbedingung).
- Keine Loader für Teilnehmer-/Anon-Routen.
- Keine Persistenz von Query-Cache (Admin ist online-only).
- Kein unrelated Refactoring außerhalb des Routing-/Admin-Datenpfads.
