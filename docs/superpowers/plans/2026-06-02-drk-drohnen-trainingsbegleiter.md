# DRK Drohnen-Trainingsbegleiter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eine offline-fähige PWA, die den papierbasierten DRK-Praxisleitfaden „Drohnensteuerer BOS" als digitalen Trainingsbegleiter abbildet — 24 Aufgaben als Nachschlagewerk plus Fortschritts-/Nachweis-Erfassung.

**Architecture:** Reines React-Frontend (Vite), kein Backend. Statische Aufgaben-Daten getrennt vom veränderlichen Nutzerfortschritt; Fortschritt liegt versioniert in `localStorage`. Die gesamte Status-/Fortschrittslogik ist als reine Funktionen in `domain/progress.ts` gekapselt und per Vitest getestet. UI ist mobile-first.

**Tech Stack:** React 18, TypeScript, Vite, `vite-plugin-pwa`, Vitest, @testing-library/react, jsdom.

---

## Quelle der Inhalte

Alle Aufgabentexte stammen aus `_Gesamttranskription.md` im Projekt-Root. Die
Aufgaben-Nummern, Titel und Zeilenbereiche stehen im Index in **Task 2**.

## File Structure

```
package.json, vite.config.ts, tsconfig.json, index.html
src/
  main.tsx                  # React-Mount
  App.tsx                   # Top-Level-State: Liste vs. Detail
  data/tasks.ts             # 24 statische Aufgaben + Typ `Aufgabe`
  domain/progress.ts        # reine Logik: Status, Fortschritt, Gesamtwerte + Typen
  hooks/useLocalStorage.ts  # persistenter State + Schema-Migration + Fallback
  hooks/useFortschritt.ts   # App-State-API über useLocalStorage
  components/
    Dashboard.tsx           # Gesamtfortschritt + 3 Teil-Sektionen
    TaskCard.tsx            # eine Aufgaben-Kachel in der Liste
    TaskDetail.tsx         # Aufgaben-Inhalt + Durchführungen + Zielanzahl
    DurchfuehrungForm.tsx  # Formular zum Hinzufügen einer Durchführung
  styles.css                # globales mobile-first Styling, DRK-Akzente
  test/setup.ts             # Testing-Library jsdom-Setup
public/
  manifest.webmanifest, icons…
```

---

## Task 1: Projekt-Setup (Vite + React + TS + Vitest)

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/test/setup.ts`, `.gitignore`

- [ ] **Step 1: Scaffolden via Vite-Template**

Run:
```bash
npm create vite@latest . -- --template react-ts
```
Falls der Ordner nicht leer ist und das CLI fragt, „Ignore files and continue" wählen. Anschließend:
```bash
npm install
npm install -D vite-plugin-pwa vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

- [ ] **Step 2: `.gitignore` ergänzen**

Sicherstellen, dass folgende Einträge vorhanden sind:
```
node_modules
dist
dist-ssr
*.local
```

- [ ] **Step 3: `vite.config.ts` mit PWA + Vitest konfigurieren**

```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'DRK Drohnen-Trainingsbegleiter',
        short_name: 'Drohnen-Training',
        description: 'Praxisleitfaden Drohnensteuerer BOS – Trainingsbegleiter',
        theme_color: '#e30613',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '.',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
});
```

- [ ] **Step 4: Test-Setup anlegen** — `src/test/setup.ts`

```ts
import '@testing-library/jest-dom';
```

- [ ] **Step 5: Test-Script in `package.json` ergänzen**

Im `"scripts"`-Block sicherstellen:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 6: Smoke-Test, dass Toolchain läuft**

Vite-Default-`App.tsx` belassen. Run:
```bash
npm run build
```
Expected: Build erfolgreich, `dist/` entsteht inkl. Service Worker (`sw.js`).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: Vite+React+TS Projektgerüst mit PWA und Vitest"
```

---

## Task 2: Statische Aufgaben-Daten (`src/data/tasks.ts`)

**Files:**
- Create: `src/data/tasks.ts`
- Test: `src/data/tasks.test.ts`

**Aufgaben-Index** (Quelle: `_Gesamttranskription.md`). `zielanzahlDefault` = Anzahl
sichtbarer Tabellenzeilen in der Transkription (beste Schätzung, in der App
editierbar); Aufgaben ohne sichtbare Zeilen starten bei `1`.

| id | teil | nummer | titel | zielanzahlDefault | Quelle (IMG) |
|----|------|--------|-------|------|------|
| 1-1 | 1 | 1.1 | Schwebeflug | 4 | 6087 |
| 1-2 | 1 | 1.2 | Landung | 8 | 6088 |
| 1-3 | 1 | 1.3 | Fliegen auf gerader Linie | 5 | 6089 |
| 1-4 | 1 | 1.4 | Rechteck | 5 | 6090 |
| 1-5 | 1 | 1.5 | U-Turn | 5 | 6091 |
| 1-6 | 1 | 1.6 | Ziel umkreisen | 8 | 6092 |
| 1-7 | 1 | 1.7 | Position anfliegen | 7 | 6093 |
| 1-8 | 1 | 1.8 | Liegende Acht | 8 | 6094 |
| 1-9 | 1 | 1.9 | Komplette Selbstumrundung | 7 | 6095 |
| 2-1 | 2 | 2.1 | Steuerungssoftware und Flugmodi | 6 | 6102 |
| 2-2 | 2 | 2.2 | Liegende Acht in größerer Entfernung | 12 | 6103 |
| 2-3 | 2 | 2.3 | Kompl. Selbstumrundung in größerer Entfernung | 12 | 6104 |
| 2-4 | 2 | 2.4 | Position in definierter Höhe anfliegen | 11 | 6105 |
| 2-5 | 2 | 2.5 | Sensoren | 9 | 6101 |
| 2-6 | 2 | 2.6 | Landung mit Bodeneffektwechsel | 13 | 6106 |
| 2-7 | 2 | 2.7 | Landung außerhalb der Sichtweite | 6 | 6107 |
| 2-8 | 2 | 2.8 | Simulierter Ausfall des GPS | 4 | 6108 |
| 2-9 | 2 | 2.9 | BVLOS-Flug | 4 | 6108 |
| 2-10 | 2 | 2.10 | Parcours | 1 | 6109 |
| 3-1 | 3 | 3.1 | Personensuche | 1 | 6110 |
| 3-2 | 3 | 3.2 | Einsatzdokumentation | 1 | 6111 |
| 3-3 | 3 | 3.3 | Ausleuchten | 1 | 6112 |
| 3-4 | 3 | 3.4 | Lastentransport | 1 | 6113 |
| 3-5 | 3 | 3.5 | Begrenzung des Einsatzbereichs | 1 | 6114 |

- [ ] **Step 1: Failing test schreiben** — `src/data/tasks.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { AUFGABEN } from './tasks';

describe('AUFGABEN', () => {
  it('enthält genau 24 Aufgaben', () => {
    expect(AUFGABEN).toHaveLength(24);
  });

  it('hat eindeutige IDs', () => {
    const ids = AUFGABEN.map((a) => a.id);
    expect(new Set(ids).size).toBe(24);
  });

  it('verteilt sich korrekt auf die drei Teile (9/10/5)', () => {
    const proTeil = (t: 1 | 2 | 3) => AUFGABEN.filter((a) => a.teil === t).length;
    expect([proTeil(1), proTeil(2), proTeil(3)]).toEqual([9, 10, 5]);
  });

  it('jede Aufgabe hat Titel, mindestens 1 Schritt und zielanzahlDefault >= 1', () => {
    for (const a of AUFGABEN) {
      expect(a.titel.length).toBeGreaterThan(0);
      expect(a.schritte.length).toBeGreaterThan(0);
      expect(a.zielanzahlDefault).toBeGreaterThanOrEqual(1);
    }
  });
});
```

- [ ] **Step 2: Test ausführen, Fehlschlag verifizieren**

Run: `npx vitest run src/data/tasks.test.ts`
Expected: FAIL (`AUFGABEN` nicht gefunden).

- [ ] **Step 3: `src/data/tasks.ts` implementieren**

Typ + alle 24 Aufgaben. Beginne mit dem Typ und den drei hier vollständig
ausgearbeiteten Mustern (eines pro Teil); die übrigen 21 Aufgaben **nach exakt
demselben Schema** aus `_Gesamttranskription.md` übertragen (Schritte =
nummerierte Punkte; `lernziel` = der/die kursiven bzw. „Durch diese Übung…"-Absätze
zusammengefasst; `durchfuehrungshinweise` = Bullet-Liste; `sicherheitshinweise`
= **fett** markierte Warnungen, sonst `[]`). `zielanzahlDefault` aus dem Index oben.

```ts
export type Aufgabe = {
  id: string;
  teil: 1 | 2 | 3;
  nummer: string;
  titel: string;
  schritte: string[];
  lernziel: string;
  durchfuehrungshinweise: string[];
  sicherheitshinweise: string[];
  zielanzahlDefault: number;
};

export const AUFGABEN: Aufgabe[] = [
  {
    id: '1-1',
    teil: 1,
    nummer: '1.1',
    titel: 'Schwebeflug',
    schritte: [
      'Starten Sie und lassen Sie die Drohne für mindestens 5 Minuten auf der Stelle in konstanter Höhe schweben (hovern).',
    ],
    lernziel:
      'Gefühl für die Steuerung der Drohne und ihr Verhalten unter Windeinfluss erlangen; eine Drohne ohne GPS im Flug stabilisieren.',
    durchfuehrungshinweise: [
      'Flug ohne Assistenzsysteme',
      'Zu Beginn „Einstiegsdrohne" empfohlen',
      'Entfernung zur Drohne ca. 5 Meter',
      'Höhe ca. 2 Meter',
      'Durchführung in Windstille und bei Wind',
    ],
    sicherheitshinweise: [],
    zielanzahlDefault: 4,
  },

  // … 1-2 bis 1-9 nach demselben Schema (siehe Index + IMG_6088–6095) …

  {
    id: '2-2',
    teil: 2,
    nummer: '2.2',
    titel: 'Liegende Acht in größerer Entfernung',
    schritte: [
      'Fliegen Sie eine Acht („Nase" immer in Flugrichtung) mit einem Durchmesser der Kreise von ca. 15 Metern.',
    ],
    lernziel:
      'Mit einer Drohne mit GPS komplexe Flugmanöver durchführen; Entfernungsschätzung und Erfassung der Drohnenausrichtung trainieren.',
    durchfuehrungshinweise: ['Entfernung zur Drohne ca. 50 Meter'],
    sicherheitshinweise: [],
    zielanzahlDefault: 12,
  },

  // … 2-1, 2-3 bis 2-10 nach demselben Schema …
  // Hinweis: 2-8 hat sicherheitshinweise:
  //   ['Übung nur in Sichtweite durchführen!',
  //    'Bei Kontrollverlust schnellstmöglich zurück in den GPS Modus wechseln.']

  {
    id: '3-1',
    teil: 3,
    nummer: '3.1',
    titel: 'Personensuche',
    schritte: [
      'Führen Sie eine simulierte Personensuche in einem vorher definierten Suchgebiet durch. Dem Drohnensteuerer darf die genaue Position der gesuchten Person(en) nicht bekannt sein.',
    ],
    lernziel:
      'Erfahrungen bei der Interpretation der Sensordaten (z. B. Wärmebild) im Kontext einer Personensuche; Flugvorbereitung und Dokumentation üben.',
    durchfuehrungshinweise: [
      'Vollständige Einsatz- und Flugplanung',
      'Suchgebiet ca. ½ km²',
      'Durchführung bei Tag und ggf. Nacht sowie im BVLOS-Flug',
    ],
    sicherheitshinweise: [],
    zielanzahlDefault: 1,
  },

  // … 3-2 bis 3-5 nach demselben Schema (IMG_6111–6114) …
];
```

- [ ] **Step 4: Test ausführen, Erfolg verifizieren**

Run: `npx vitest run src/data/tasks.test.ts`
Expected: PASS (4 Tests grün).

- [ ] **Step 5: Commit**

```bash
git add src/data/tasks.ts src/data/tasks.test.ts
git commit -m "feat: 24 Aufgaben des Praxisleitfadens als statische Daten"
```

---

## Task 3: Fortschrittslogik (`src/domain/progress.ts`)

**Files:**
- Create: `src/domain/progress.ts`
- Test: `src/domain/progress.test.ts`

- [ ] **Step 1: Failing test schreiben** — `src/domain/progress.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import {
  type AufgabenFortschritt,
  leererFortschritt,
  aufgabenStatus,
  aufgabenQuote,
  gesamtFortschritt,
} from './progress';

const mit = (over: Partial<AufgabenFortschritt>): AufgabenFortschritt => ({
  ...leererFortschritt(3),
  ...over,
});

const durchfuehrungen = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: String(i),
    datum: '2026-06-02',
    drohnensteuerer: '',
    luftraumbeobachter: '',
  }));

describe('aufgabenStatus', () => {
  it('ist "offen" ohne Durchführungen', () => {
    expect(aufgabenStatus(mit({}))).toBe('offen');
  });
  it('ist "erledigt", wenn Zielanzahl erreicht', () => {
    expect(aufgabenStatus(mit({ durchfuehrungen: durchfuehrungen(3) }))).toBe('erledigt');
  });
  it('ist "offen", wenn Zielanzahl noch nicht erreicht', () => {
    expect(aufgabenStatus(mit({ durchfuehrungen: durchfuehrungen(2) }))).toBe('offen');
  });
  it('ist "nicht-anwendbar", unabhängig von Durchführungen', () => {
    expect(
      aufgabenStatus(mit({ nichtAnwendbar: true, durchfuehrungen: durchfuehrungen(5) })),
    ).toBe('nicht-anwendbar');
  });
});

describe('aufgabenQuote', () => {
  it('begrenzt auf 1 (kein Überlauf)', () => {
    expect(aufgabenQuote(mit({ durchfuehrungen: durchfuehrungen(5) }))).toBe(1);
  });
  it('rechnet anteilig', () => {
    expect(aufgabenQuote(mit({ durchfuehrungen: durchfuehrungen(1) }))).toBeCloseTo(1 / 3);
  });
});

describe('gesamtFortschritt', () => {
  it('zählt erledigte und ignoriert nicht-anwendbare im Nenner', () => {
    const map = {
      a: mit({ durchfuehrungen: durchfuehrungen(3) }),       // erledigt
      b: mit({}),                                            // offen
      c: mit({ nichtAnwendbar: true }),                      // n.a.
    };
    expect(gesamtFortschritt(map)).toEqual({ erledigt: 1, gesamt: 2 });
  });
});
```

- [ ] **Step 2: Test ausführen, Fehlschlag verifizieren**

Run: `npx vitest run src/domain/progress.test.ts`
Expected: FAIL (Modul/Exports fehlen).

- [ ] **Step 3: `src/domain/progress.ts` implementieren**

```ts
export type Durchfuehrung = {
  id: string;
  datum: string; // ISO yyyy-mm-dd
  drohnensteuerer: string;
  luftraumbeobachter: string;
};

export type AufgabenFortschritt = {
  zielanzahl: number;
  durchfuehrungen: Durchfuehrung[];
  nichtAnwendbar: boolean;
};

export type AufgabenStatus = 'offen' | 'erledigt' | 'nicht-anwendbar';

export function leererFortschritt(zielanzahl: number): AufgabenFortschritt {
  return { zielanzahl: Math.max(1, zielanzahl), durchfuehrungen: [], nichtAnwendbar: false };
}

export function aufgabenStatus(f: AufgabenFortschritt): AufgabenStatus {
  if (f.nichtAnwendbar) return 'nicht-anwendbar';
  return f.durchfuehrungen.length >= f.zielanzahl ? 'erledigt' : 'offen';
}

export function aufgabenQuote(f: AufgabenFortschritt): number {
  const ziel = Math.max(1, f.zielanzahl);
  return Math.min(1, f.durchfuehrungen.length / ziel);
}

export function gesamtFortschritt(
  map: Record<string, AufgabenFortschritt>,
): { erledigt: number; gesamt: number } {
  const werte = Object.values(map);
  const gesamt = werte.filter((f) => !f.nichtAnwendbar).length;
  const erledigt = werte.filter((f) => aufgabenStatus(f) === 'erledigt').length;
  return { erledigt, gesamt };
}
```

- [ ] **Step 4: Test ausführen, Erfolg verifizieren**

Run: `npx vitest run src/domain/progress.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/progress.ts src/domain/progress.test.ts
git commit -m "feat: reine Fortschritts- und Statuslogik"
```

---

## Task 4: Persistenter State mit Migration (`src/hooks/useLocalStorage.ts`)

**Files:**
- Create: `src/hooks/useLocalStorage.ts`
- Test: `src/hooks/useLocalStorage.test.ts`

- [ ] **Step 1: Failing test schreiben** — `src/hooks/useLocalStorage.test.ts`

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLocalStorage } from './useLocalStorage';

beforeEach(() => localStorage.clear());

describe('useLocalStorage', () => {
  it('liefert den Default, wenn nichts gespeichert ist', () => {
    const { result } = renderHook(() => useLocalStorage('k', { n: 1 }));
    expect(result.current[0]).toEqual({ n: 1 });
  });

  it('persistiert Updates und liest sie zurück', () => {
    const { result, unmount } = renderHook(() => useLocalStorage('k', { n: 1 }));
    act(() => result.current[1]({ n: 2 }));
    expect(result.current[0]).toEqual({ n: 2 });
    unmount();
    const { result: zweiter } = renderHook(() => useLocalStorage('k', { n: 1 }));
    expect(zweiter.current[0]).toEqual({ n: 2 });
  });

  it('fällt bei kaputtem JSON auf den Default zurück', () => {
    localStorage.setItem('k', '{kaputt');
    const { result } = renderHook(() => useLocalStorage('k', { n: 9 }));
    expect(result.current[0]).toEqual({ n: 9 });
  });
});
```

- [ ] **Step 2: Test ausführen, Fehlschlag verifizieren**

Run: `npx vitest run src/hooks/useLocalStorage.test.ts`
Expected: FAIL (Hook fehlt).

- [ ] **Step 3: `src/hooks/useLocalStorage.ts` implementieren**

```ts
import { useCallback, useEffect, useState } from 'react';

function lesen<T>(key: string, fallback: T): T {
  try {
    const roh = localStorage.getItem(key);
    if (roh == null) return fallback;
    return JSON.parse(roh) as T;
  } catch {
    return fallback;
  }
}

export function useLocalStorage<T>(key: string, initial: T): [T, (next: T) => void] {
  const [wert, setWert] = useState<T>(() => lesen(key, initial));

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(wert));
    } catch {
      // Storage nicht verfügbar/voll: State bleibt im Speicher nutzbar.
    }
  }, [key, wert]);

  const setzen = useCallback((next: T) => setWert(next), []);
  return [wert, setzen];
}
```

- [ ] **Step 4: Test ausführen, Erfolg verifizieren**

Run: `npx vitest run src/hooks/useLocalStorage.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useLocalStorage.ts src/hooks/useLocalStorage.test.ts
git commit -m "feat: useLocalStorage mit Fallback bei Fehlern"
```

---

## Task 5: App-State-API (`src/hooks/useFortschritt.ts`)

**Files:**
- Create: `src/hooks/useFortschritt.ts`
- Test: `src/hooks/useFortschritt.test.ts`

Dieser Hook hält den gesamten Fortschritt (`Record<aufgabeId, AufgabenFortschritt>`),
initialisiert fehlende Aufgaben aus `AUFGABEN` (inkl. `zielanzahlDefault`) und
trägt eine `schemaVersion` für spätere Migrationen.

- [ ] **Step 1: Failing test schreiben** — `src/hooks/useFortschritt.test.ts`

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFortschritt } from './useFortschritt';

beforeEach(() => localStorage.clear());

describe('useFortschritt', () => {
  it('initialisiert jede Aufgabe mit ihrer Default-Zielanzahl', () => {
    const { result } = renderHook(() => useFortschritt());
    expect(result.current.fortschritt['1-1'].zielanzahl).toBe(4);
    expect(result.current.fortschritt['1-1'].durchfuehrungen).toEqual([]);
  });

  it('fügt eine Durchführung hinzu', () => {
    const { result } = renderHook(() => useFortschritt());
    act(() =>
      result.current.durchfuehrungHinzufuegen('1-1', {
        datum: '2026-06-02',
        drohnensteuerer: 'A',
        luftraumbeobachter: 'B',
      }),
    );
    expect(result.current.fortschritt['1-1'].durchfuehrungen).toHaveLength(1);
    expect(result.current.fortschritt['1-1'].durchfuehrungen[0].id).toBeTruthy();
  });

  it('entfernt eine Durchführung', () => {
    const { result } = renderHook(() => useFortschritt());
    act(() =>
      result.current.durchfuehrungHinzufuegen('1-1', {
        datum: '2026-06-02',
        drohnensteuerer: '',
        luftraumbeobachter: '',
      }),
    );
    const id = result.current.fortschritt['1-1'].durchfuehrungen[0].id;
    act(() => result.current.durchfuehrungEntfernen('1-1', id));
    expect(result.current.fortschritt['1-1'].durchfuehrungen).toHaveLength(0);
  });

  it('setzt die Zielanzahl (minimal 1)', () => {
    const { result } = renderHook(() => useFortschritt());
    act(() => result.current.zielanzahlSetzen('1-1', 0));
    expect(result.current.fortschritt['1-1'].zielanzahl).toBe(1);
  });

  it('schaltet nicht-anwendbar um', () => {
    const { result } = renderHook(() => useFortschritt());
    act(() => result.current.nichtAnwendbarSetzen('2-1', true));
    expect(result.current.fortschritt['2-1'].nichtAnwendbar).toBe(true);
  });
});
```

- [ ] **Step 2: Test ausführen, Fehlschlag verifizieren**

Run: `npx vitest run src/hooks/useFortschritt.test.ts`
Expected: FAIL (Hook fehlt).

- [ ] **Step 3: `src/hooks/useFortschritt.ts` implementieren**

```ts
import { useCallback } from 'react';
import { AUFGABEN } from '../data/tasks';
import {
  type AufgabenFortschritt,
  type Durchfuehrung,
  leererFortschritt,
} from '../domain/progress';
import { useLocalStorage } from './useLocalStorage';

const STORAGE_KEY = 'drk-drohnen-fortschritt';
const SCHEMA_VERSION = 1;

type AppState = {
  schemaVersion: number;
  fortschritt: Record<string, AufgabenFortschritt>;
};

function initialerState(): AppState {
  const fortschritt: Record<string, AufgabenFortschritt> = {};
  for (const a of AUFGABEN) fortschritt[a.id] = leererFortschritt(a.zielanzahlDefault);
  return { schemaVersion: SCHEMA_VERSION, fortschritt };
}

// Mischt fehlende Aufgaben nach (z. B. nach Inhalts-Update) und respektiert Schema.
function migrieren(state: AppState): AppState {
  const basis = initialerState();
  const gemischt: Record<string, AufgabenFortschritt> = { ...basis.fortschritt };
  for (const a of AUFGABEN) {
    if (state.fortschritt?.[a.id]) gemischt[a.id] = state.fortschritt[a.id];
  }
  return { schemaVersion: SCHEMA_VERSION, fortschritt: gemischt };
}

let zaehler = 0;
function neueId(): string {
  zaehler += 1;
  return `d-${zaehler}-${zaehler * 31 + 7}`;
}

export function useFortschritt() {
  const [state, setState] = useLocalStorage<AppState>(STORAGE_KEY, initialerState());
  const sicher = state.schemaVersion === SCHEMA_VERSION ? state : migrieren(state);

  const aendern = useCallback(
    (id: string, fn: (f: AufgabenFortschritt) => AufgabenFortschritt) => {
      const vorher = sicher.fortschritt[id];
      if (!vorher) return;
      setState({
        ...sicher,
        fortschritt: { ...sicher.fortschritt, [id]: fn(vorher) },
      });
    },
    [sicher, setState],
  );

  const durchfuehrungHinzufuegen = useCallback(
    (id: string, eintrag: Omit<Durchfuehrung, 'id'>) =>
      aendern(id, (f) => ({
        ...f,
        durchfuehrungen: [...f.durchfuehrungen, { ...eintrag, id: neueId() }],
      })),
    [aendern],
  );

  const durchfuehrungEntfernen = useCallback(
    (id: string, eintragId: string) =>
      aendern(id, (f) => ({
        ...f,
        durchfuehrungen: f.durchfuehrungen.filter((d) => d.id !== eintragId),
      })),
    [aendern],
  );

  const zielanzahlSetzen = useCallback(
    (id: string, ziel: number) =>
      aendern(id, (f) => ({ ...f, zielanzahl: Math.max(1, Math.floor(ziel) || 1) })),
    [aendern],
  );

  const nichtAnwendbarSetzen = useCallback(
    (id: string, wert: boolean) => aendern(id, (f) => ({ ...f, nichtAnwendbar: wert })),
    [aendern],
  );

  return {
    fortschritt: sicher.fortschritt,
    durchfuehrungHinzufuegen,
    durchfuehrungEntfernen,
    zielanzahlSetzen,
    nichtAnwendbarSetzen,
  };
}
```

- [ ] **Step 4: Test ausführen, Erfolg verifizieren**

Run: `npx vitest run src/hooks/useFortschritt.test.ts`
Expected: PASS (5 Tests grün).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useFortschritt.ts src/hooks/useFortschritt.test.ts
git commit -m "feat: useFortschritt – State-API mit Schema-Migration"
```

---

## Task 6: Durchführungs-Formular (`src/components/DurchfuehrungForm.tsx`)

**Files:**
- Create: `src/components/DurchfuehrungForm.tsx`
- Test: `src/components/DurchfuehrungForm.test.tsx`

- [ ] **Step 1: Failing test schreiben** — `src/components/DurchfuehrungForm.test.tsx`

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DurchfuehrungForm } from './DurchfuehrungForm';

describe('DurchfuehrungForm', () => {
  it('ruft onAdd mit den Feldwerten auf', async () => {
    const onAdd = vi.fn();
    render(<DurchfuehrungForm onAdd={onAdd} heute="2026-06-02" />);

    await userEvent.type(screen.getByLabelText(/Drohnensteuerer/i), 'Max');
    await userEvent.type(screen.getByLabelText(/Luftraumbeobachter/i), 'Erika');
    await userEvent.click(screen.getByRole('button', { name: /hinzufügen/i }));

    expect(onAdd).toHaveBeenCalledWith({
      datum: '2026-06-02',
      drohnensteuerer: 'Max',
      luftraumbeobachter: 'Erika',
    });
  });

  it('belegt das Datum mit heute vor', () => {
    render(<DurchfuehrungForm onAdd={vi.fn()} heute="2026-06-02" />);
    expect(screen.getByLabelText(/Datum/i)).toHaveValue('2026-06-02');
  });
});
```

- [ ] **Step 2: Test ausführen, Fehlschlag verifizieren**

Run: `npx vitest run src/components/DurchfuehrungForm.test.tsx`
Expected: FAIL (Komponente fehlt).

- [ ] **Step 3: `src/components/DurchfuehrungForm.tsx` implementieren**

```tsx
import { useState, type FormEvent } from 'react';
import type { Durchfuehrung } from '../domain/progress';

type Props = {
  onAdd: (eintrag: Omit<Durchfuehrung, 'id'>) => void;
  heute: string;
};

export function DurchfuehrungForm({ onAdd, heute }: Props) {
  const [datum, setDatum] = useState(heute);
  const [drohnensteuerer, setDrohnensteuerer] = useState('');
  const [luftraumbeobachter, setLuftraumbeobachter] = useState('');

  function absenden(e: FormEvent) {
    e.preventDefault();
    onAdd({ datum, drohnensteuerer, luftraumbeobachter });
    setDrohnensteuerer('');
    setLuftraumbeobachter('');
    setDatum(heute);
  }

  return (
    <form className="df-form" onSubmit={absenden}>
      <label>
        Datum
        <input type="date" value={datum} onChange={(e) => setDatum(e.target.value)} />
      </label>
      <label>
        Drohnensteuerer
        <input
          type="text"
          value={drohnensteuerer}
          onChange={(e) => setDrohnensteuerer(e.target.value)}
          autoComplete="off"
        />
      </label>
      <label>
        Luftraumbeobachter
        <input
          type="text"
          value={luftraumbeobachter}
          onChange={(e) => setLuftraumbeobachter(e.target.value)}
          autoComplete="off"
        />
      </label>
      <button type="submit">Durchführung hinzufügen</button>
    </form>
  );
}
```

- [ ] **Step 4: Test ausführen, Erfolg verifizieren**

Run: `npx vitest run src/components/DurchfuehrungForm.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/DurchfuehrungForm.tsx src/components/DurchfuehrungForm.test.tsx
git commit -m "feat: Formular zum Erfassen einer Durchführung"
```

---

## Task 7: Aufgaben-Detail (`src/components/TaskDetail.tsx`)

**Files:**
- Create: `src/components/TaskDetail.tsx`
- Test: `src/components/TaskDetail.test.tsx`

- [ ] **Step 1: Failing test schreiben** — `src/components/TaskDetail.test.tsx`

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TaskDetail } from './TaskDetail';
import type { Aufgabe } from '../data/tasks';
import { leererFortschritt } from '../domain/progress';

const aufgabe: Aufgabe = {
  id: '2-8',
  teil: 2,
  nummer: '2.8',
  titel: 'Simulierter Ausfall des GPS',
  schritte: ['Schritt eins'],
  lernziel: 'Lernziel-Text',
  durchfuehrungshinweise: ['Hinweis A'],
  sicherheitshinweise: ['Übung nur in Sichtweite durchführen!'],
  zielanzahlDefault: 4,
};

function setup(over = {}) {
  const handlers = {
    onAdd: vi.fn(),
    onRemove: vi.fn(),
    onZielanzahl: vi.fn(),
    onNichtAnwendbar: vi.fn(),
    onBack: vi.fn(),
  };
  render(
    <TaskDetail
      aufgabe={aufgabe}
      fortschritt={leererFortschritt(4)}
      heute="2026-06-02"
      {...handlers}
      {...over}
    />,
  );
  return handlers;
}

describe('TaskDetail', () => {
  it('zeigt Titel, Schritte, Lernziel und Sicherheitshinweis', () => {
    setup();
    expect(screen.getByText(/Simulierter Ausfall des GPS/)).toBeInTheDocument();
    expect(screen.getByText('Schritt eins')).toBeInTheDocument();
    expect(screen.getByText(/Lernziel-Text/)).toBeInTheDocument();
    expect(screen.getByText(/nur in Sichtweite/)).toBeInTheDocument();
  });

  it('reicht eine neue Durchführung an onAdd weiter', async () => {
    const { onAdd } = setup();
    await userEvent.click(screen.getByRole('button', { name: /hinzufügen/i }));
    expect(onAdd).toHaveBeenCalled();
  });

  it('blendet bei "nicht anwendbar" das Erfassen aus', () => {
    setup({ fortschritt: { ...leererFortschritt(4), nichtAnwendbar: true } });
    expect(screen.queryByRole('button', { name: /hinzufügen/i })).toBeNull();
  });
});
```

- [ ] **Step 2: Test ausführen, Fehlschlag verifizieren**

Run: `npx vitest run src/components/TaskDetail.test.tsx`
Expected: FAIL (Komponente fehlt).

- [ ] **Step 3: `src/components/TaskDetail.tsx` implementieren**

```tsx
import type { Aufgabe } from '../data/tasks';
import {
  type AufgabenFortschritt,
  type Durchfuehrung,
  aufgabenStatus,
} from '../domain/progress';
import { DurchfuehrungForm } from './DurchfuehrungForm';

type Props = {
  aufgabe: Aufgabe;
  fortschritt: AufgabenFortschritt;
  heute: string;
  onAdd: (eintrag: Omit<Durchfuehrung, 'id'>) => void;
  onRemove: (eintragId: string) => void;
  onZielanzahl: (ziel: number) => void;
  onNichtAnwendbar: (wert: boolean) => void;
  onBack: () => void;
};

export function TaskDetail({
  aufgabe,
  fortschritt,
  heute,
  onAdd,
  onRemove,
  onZielanzahl,
  onNichtAnwendbar,
  onBack,
}: Props) {
  const status = aufgabenStatus(fortschritt);
  const istTeil23 = aufgabe.teil !== 1;

  return (
    <article className="detail">
      <button className="zurueck" onClick={onBack}>← Übersicht</button>
      <h2>
        Aufgabe {aufgabe.nummer} – {aufgabe.titel}
      </h2>

      <ol className="schritte">
        {aufgabe.schritte.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>

      <p className="lernziel">{aufgabe.lernziel}</p>

      {aufgabe.durchfuehrungshinweise.length > 0 && (
        <>
          <h3>Durchführungshinweise</h3>
          <ul>
            {aufgabe.durchfuehrungshinweise.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ul>
        </>
      )}

      {aufgabe.sicherheitshinweise.length > 0 && (
        <div className="warnung" role="note">
          <strong>Sicherheitshinweise</strong>
          <ul>
            {aufgabe.sicherheitshinweise.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ul>
        </div>
      )}

      {istTeil23 && (
        <label className="na-toggle">
          <input
            type="checkbox"
            checked={fortschritt.nichtAnwendbar}
            onChange={(e) => onNichtAnwendbar(e.target.checked)}
          />
          Nicht anwendbar (nicht mit unserem Einsatzsystem umsetzbar)
        </label>
      )}

      {!fortschritt.nichtAnwendbar && (
        <section className="erfassung">
          <h3>
            Durchführungen ({fortschritt.durchfuehrungen.length} / {fortschritt.zielanzahl})
            {status === 'erledigt' && ' ✓'}
          </h3>

          <label className="ziel">
            Zielanzahl
            <input
              type="number"
              min={1}
              value={fortschritt.zielanzahl}
              onChange={(e) => onZielanzahl(Number(e.target.value))}
            />
          </label>

          <ul className="liste">
            {fortschritt.durchfuehrungen.map((d) => (
              <li key={d.id}>
                <span>
                  {d.datum} · {d.drohnensteuerer || '—'} / {d.luftraumbeobachter || '—'}
                </span>
                <button onClick={() => onRemove(d.id)} aria-label="Eintrag löschen">
                  ✕
                </button>
              </li>
            ))}
          </ul>

          <DurchfuehrungForm onAdd={onAdd} heute={heute} />
        </section>
      )}
    </article>
  );
}
```

- [ ] **Step 4: Test ausführen, Erfolg verifizieren**

Run: `npx vitest run src/components/TaskDetail.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/TaskDetail.tsx src/components/TaskDetail.test.tsx
git commit -m "feat: Aufgaben-Detailansicht mit Erfassung"
```

---

## Task 8: Übersicht (`src/components/TaskCard.tsx` + `src/components/Dashboard.tsx`)

**Files:**
- Create: `src/components/TaskCard.tsx`, `src/components/Dashboard.tsx`
- Test: `src/components/Dashboard.test.tsx`

- [ ] **Step 1: Failing test schreiben** — `src/components/Dashboard.test.tsx`

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dashboard } from './Dashboard';
import { AUFGABEN } from '../data/tasks';
import { leererFortschritt } from '../domain/progress';

function vollerFortschritt() {
  const f: Record<string, ReturnType<typeof leererFortschritt>> = {};
  for (const a of AUFGABEN) f[a.id] = leererFortschritt(a.zielanzahlDefault);
  return f;
}

describe('Dashboard', () => {
  it('zeigt den Gesamtfortschritt 0 / 24', () => {
    render(<Dashboard fortschritt={vollerFortschritt()} onSelect={vi.fn()} />);
    expect(screen.getByText(/0 \/ 24/)).toBeInTheDocument();
  });

  it('listet alle 24 Aufgaben', () => {
    render(<Dashboard fortschritt={vollerFortschritt()} onSelect={vi.fn()} />);
    expect(screen.getByText(/1\.1/)).toBeInTheDocument();
    expect(screen.getByText(/3\.5/)).toBeInTheDocument();
  });

  it('ruft onSelect mit der Aufgaben-ID auf', async () => {
    const onSelect = vi.fn();
    render(<Dashboard fortschritt={vollerFortschritt()} onSelect={onSelect} />);
    await userEvent.click(screen.getByText(/Schwebeflug/));
    expect(onSelect).toHaveBeenCalledWith('1-1');
  });
});
```

- [ ] **Step 2: Test ausführen, Fehlschlag verifizieren**

Run: `npx vitest run src/components/Dashboard.test.tsx`
Expected: FAIL (Komponenten fehlen).

- [ ] **Step 3: `src/components/TaskCard.tsx` implementieren**

```tsx
import type { Aufgabe } from '../data/tasks';
import { type AufgabenFortschritt, aufgabenStatus } from '../domain/progress';

const LABEL: Record<string, string> = {
  offen: 'offen',
  erledigt: 'erledigt',
  'nicht-anwendbar': 'n. a.',
};

type Props = {
  aufgabe: Aufgabe;
  fortschritt: AufgabenFortschritt;
  onSelect: (id: string) => void;
};

export function TaskCard({ aufgabe, fortschritt, onSelect }: Props) {
  const status = aufgabenStatus(fortschritt);
  return (
    <button className={`card status-${status}`} onClick={() => onSelect(aufgabe.id)}>
      <span className="nummer">{aufgabe.nummer}</span>
      <span className="titel">{aufgabe.titel}</span>
      <span className="meta">
        {status !== 'nicht-anwendbar' && (
          <span className="zaehler">
            {fortschritt.durchfuehrungen.length} / {fortschritt.zielanzahl}
          </span>
        )}
        <span className="badge">{LABEL[status]}</span>
      </span>
    </button>
  );
}
```

- [ ] **Step 4: `src/components/Dashboard.tsx` implementieren**

```tsx
import { AUFGABEN } from '../data/tasks';
import { type AufgabenFortschritt, gesamtFortschritt } from '../domain/progress';
import { TaskCard } from './TaskCard';

const TEILE: { teil: 1 | 2 | 3; titel: string }[] = [
  { teil: 1, titel: 'Teil 1 – Grundlegende Steuerung' },
  { teil: 2, titel: 'Teil 2 – Sichere Steuerung in einsatznahen Situationen' },
  { teil: 3, titel: 'Teil 3 – Training von Einsatzszenarien' },
];

type Props = {
  fortschritt: Record<string, AufgabenFortschritt>;
  onSelect: (id: string) => void;
};

export function Dashboard({ fortschritt, onSelect }: Props) {
  const { erledigt, gesamt } = gesamtFortschritt(fortschritt);
  const prozent = gesamt === 0 ? 0 : Math.round((erledigt / gesamt) * 100);

  return (
    <div className="dashboard">
      <header className="kopf">
        <h1>Drohnen-Trainingsbegleiter</h1>
        <p className="gesamt">
          {erledigt} / {gesamt} erledigt
        </p>
        <div className="balken">
          <div className="balken-fuell" style={{ width: `${prozent}%` }} />
        </div>
      </header>

      {TEILE.map(({ teil, titel }) => (
        <section key={teil}>
          <h2>{titel}</h2>
          <div className="cards">
            {AUFGABEN.filter((a) => a.teil === teil).map((a) => (
              <TaskCard
                key={a.id}
                aufgabe={a}
                fortschritt={fortschritt[a.id]}
                onSelect={onSelect}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Tests ausführen, Erfolg verifizieren**

Run: `npx vitest run src/components/Dashboard.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/TaskCard.tsx src/components/Dashboard.tsx src/components/Dashboard.test.tsx
git commit -m "feat: Übersicht mit Aufgaben-Kacheln und Gesamtfortschritt"
```

---

## Task 9: App-Verdrahtung & Styling (`src/App.tsx`, `src/styles.css`)

**Files:**
- Modify: `src/App.tsx` (Vite-Default ersetzen), `src/main.tsx` (CSS-Import)
- Create: `src/styles.css`
- Test: `src/App.test.tsx`

- [ ] **Step 1: Failing test schreiben** — `src/App.test.tsx`

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

beforeEach(() => localStorage.clear());

describe('App', () => {
  it('startet in der Übersicht', () => {
    render(<App />);
    expect(screen.getByText(/Drohnen-Trainingsbegleiter/)).toBeInTheDocument();
  });

  it('navigiert in die Detailansicht und zurück', async () => {
    render(<App />);
    await userEvent.click(screen.getByText(/Schwebeflug/));
    expect(screen.getByText(/Aufgabe 1\.1/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Übersicht/ }));
    expect(screen.getByText(/erledigt/)).toBeInTheDocument();
  });

  it('eine erfasste Durchführung erhöht den Zähler nach Rückkehr', async () => {
    render(<App />);
    await userEvent.click(screen.getByText(/Schwebeflug/));
    await userEvent.click(screen.getByRole('button', { name: /hinzufügen/i }));
    await userEvent.click(screen.getByRole('button', { name: /Übersicht/ }));
    await userEvent.click(screen.getByText(/Schwebeflug/));
    expect(screen.getByText(/1 \/ 4/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Test ausführen, Fehlschlag verifizieren**

Run: `npx vitest run src/App.test.tsx`
Expected: FAIL (App-Struktur fehlt noch).

- [ ] **Step 3: `src/App.tsx` implementieren**

`heute` wird einmalig beim Mount bestimmt (in Tests deterministisch genug; die
Fortschrittslogik hängt nicht vom konkreten Datum ab).

```tsx
import { useMemo, useState } from 'react';
import { AUFGABEN } from './data/tasks';
import { Dashboard } from './components/Dashboard';
import { TaskDetail } from './components/TaskDetail';
import { useFortschritt } from './hooks/useFortschritt';

export default function App() {
  const [aktiv, setAktiv] = useState<string | null>(null);
  const {
    fortschritt,
    durchfuehrungHinzufuegen,
    durchfuehrungEntfernen,
    zielanzahlSetzen,
    nichtAnwendbarSetzen,
  } = useFortschritt();

  const heute = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const aufgabe = aktiv ? AUFGABEN.find((a) => a.id === aktiv) ?? null : null;

  if (aufgabe) {
    return (
      <main className="app">
        <TaskDetail
          aufgabe={aufgabe}
          fortschritt={fortschritt[aufgabe.id]}
          heute={heute}
          onAdd={(e) => durchfuehrungHinzufuegen(aufgabe.id, e)}
          onRemove={(eid) => durchfuehrungEntfernen(aufgabe.id, eid)}
          onZielanzahl={(z) => zielanzahlSetzen(aufgabe.id, z)}
          onNichtAnwendbar={(w) => nichtAnwendbarSetzen(aufgabe.id, w)}
          onBack={() => setAktiv(null)}
        />
      </main>
    );
  }

  return (
    <main className="app">
      <Dashboard fortschritt={fortschritt} onSelect={setAktiv} />
    </main>
  );
}
```

- [ ] **Step 4: `src/main.tsx` CSS importieren**

Sicherstellen, dass oben steht (Vite-Default-`index.css`-Import durch unseren ersetzen):
```tsx
import './styles.css';
```
Eventuell vorhandene `import './index.css'`-Zeile entfernen und die Datei `src/index.css` löschen, falls vom Template angelegt.

- [ ] **Step 5: `src/styles.css` implementieren (mobile-first, DRK-Akzente)**

```css
:root {
  --drk-rot: #e30613;
  --grau: #f2f2f2;
  --text: #1a1a1a;
}
* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, sans-serif; color: var(--text); }
.app { max-width: 640px; margin: 0 auto; padding: 16px; }

.kopf h1 { font-size: 1.3rem; margin: 0 0 4px; }
.gesamt { font-weight: 600; margin: 0 0 8px; }
.balken { height: 10px; background: var(--grau); border-radius: 5px; overflow: hidden; }
.balken-fuell { height: 100%; background: var(--drk-rot); transition: width 0.3s; }

section h2 { font-size: 1rem; margin: 20px 0 8px; }
.cards { display: flex; flex-direction: column; gap: 8px; }
.card {
  display: grid; grid-template-columns: auto 1fr auto; gap: 8px; align-items: center;
  width: 100%; min-height: 56px; padding: 12px; border: 1px solid #ddd; border-radius: 10px;
  background: #fff; text-align: left; font-size: 1rem; cursor: pointer;
}
.card .nummer { font-weight: 700; color: var(--drk-rot); }
.card .meta { display: flex; gap: 8px; align-items: center; }
.badge { font-size: 0.75rem; padding: 2px 8px; border-radius: 999px; background: var(--grau); }
.status-erledigt { border-color: var(--drk-rot); }
.status-erledigt .badge { background: var(--drk-rot); color: #fff; }
.status-nicht-anwendbar { opacity: 0.6; }

.detail .zurueck { background: none; border: none; color: var(--drk-rot); font-size: 1rem; padding: 8px 0; cursor: pointer; }
.detail h2 { font-size: 1.2rem; }
.lernziel { font-style: italic; color: #444; }
.warnung { border: 2px solid var(--drk-rot); border-radius: 10px; padding: 8px 12px; background: #fff5f5; }
.na-toggle { display: flex; gap: 8px; align-items: center; margin: 12px 0; }
.erfassung .liste { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.erfassung .liste li { display: flex; justify-content: space-between; align-items: center; background: var(--grau); padding: 8px 12px; border-radius: 8px; }
.df-form { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; }
.df-form label { display: flex; flex-direction: column; gap: 4px; font-size: 0.9rem; }
.df-form input, .ziel input { min-height: 44px; padding: 8px; font-size: 1rem; border: 1px solid #ccc; border-radius: 8px; }
.df-form button, .erfassung button[type="submit"] { min-height: 48px; background: var(--drk-rot); color: #fff; border: none; border-radius: 8px; font-size: 1rem; cursor: pointer; }
```

- [ ] **Step 6: Tests ausführen, Erfolg verifizieren**

Run: `npx vitest run src/App.test.tsx`
Expected: PASS (3 Tests grün).

- [ ] **Step 7: Komplette Test-Suite + Build**

Run:
```bash
npm run test
npm run build
```
Expected: alle Tests grün; Build erzeugt `dist/` inkl. `sw.js` und `manifest.webmanifest`.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: App-Verdrahtung, Navigation und mobile-first Styling"
```

---

## Task 10: PWA-Feinschliff (Icons, Manifest, Offline-Check)

**Files:**
- Create: `public/icons/icon-192.png`, `public/icons/icon-512.png`
- Modify: `index.html` (Titel, theme-color, lang)

- [ ] **Step 1: App-Icons bereitstellen**

Zwei PNG-Icons (192×192 und 512×512) unter `public/icons/` ablegen. Platzhalter
erzeugen (einfarbig DRK-Rot), falls noch kein Logo vorliegt:
```bash
mkdir -p public/icons
# Falls ImageMagick verfügbar:
magick -size 512x512 xc:'#e30613' public/icons/icon-512.png
magick -size 192x192 xc:'#e30613' public/icons/icon-192.png
```
Falls ImageMagick fehlt: zwei beliebige PNGs der genannten Größen ablegen und
später durch das offizielle Logo ersetzen.

- [ ] **Step 2: `index.html` anpassen**

`<html lang="de">`, `<title>DRK Drohnen-Trainingsbegleiter</title>` und im `<head>`:
```html
<meta name="theme-color" content="#e30613" />
```

- [ ] **Step 3: Produktions-Build + lokale Vorschau**

Run:
```bash
npm run build
npm run preview
```
Expected: App öffnet unter der Preview-URL; im Browser-DevTools → Application →
Service Workers ist ein aktiver SW registriert, unter Manifest erscheinen Name
und Icons.

- [ ] **Step 4: Offline-Check (manuell)**

In der Preview im DevTools-Tab „Network" auf „Offline" stellen und neu laden:
Die App lädt weiterhin, erfasste Durchführungen bleiben erhalten (localStorage).

- [ ] **Step 5: README ergänzen** — `README.md`

Kurzbeschreibung, Setup (`npm install`), Entwicklung (`npm run dev`), Tests
(`npm run test`), Build (`npm run build`) und der Hinweis, dass die
`zielanzahlDefault`-Werte Schätzungen sind und in der App pro Aufgabe angepasst
werden können.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: PWA-Icons, Manifest-Feinschliff und README"
```

---

## Self-Review (vom Plan-Autor durchgeführt)

- **Spec-Abdeckung:** Stack/PWA → Task 1,10. Statische Aufgaben/Datenmodell →
  Task 2. Status-/Fortschrittslogik (inkl. Gesamtberechnung, „nicht anwendbar")
  → Task 3. localStorage + Migration → Task 4,5. Editierbare Zielanzahl → Task
  5,7. Dashboard/Detail/Formular → Task 6,7,8. Fehlerfälle (Storage-Fallback,
  Schema-Version, Ziel ≥ 1) → Task 3,4,5. Testing → jede Task TDD. Offline →
  Task 10.
- **Platzhalter:** Code in allen Code-Steps vollständig. Einzige bewusste
  Daten-Übertragung: die restlichen 21 Aufgaben in Task 2 — kein Code-Platzhalter,
  sondern Datenerfassung aus benannter Quelle mit vollständigem Index, Schema und
  drei ausgearbeiteten Mustern.
- **Typ-Konsistenz:** `AufgabenFortschritt`, `Durchfuehrung`, `Aufgabe` und die
  Handler-Namen (`durchfuehrungHinzufuegen`, `zielanzahlSetzen`,
  `nichtAnwendbarSetzen`, `durchfuehrungEntfernen`) sind über Tasks 3,5,7,9
  identisch verwendet.
