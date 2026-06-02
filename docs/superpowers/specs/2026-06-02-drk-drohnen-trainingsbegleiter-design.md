# Design: DRK Drohnen-Trainingsbegleiter (PWA)

_Datum: 2026-06-02 · Status: Entwurf zur Freigabe_

## 1. Zweck & Kontext

Digitaler Begleiter für die praktische Ausbildung „Drohnensteuerer BOS" (DRK
Landesverband Niedersachsen e.V.). Die App löst den papierbasierten
Praxisleitfaden (`_Gesamttranskription.md`, 24 Aufgaben in 3 Teilen) ab: Sie
zeigt jede Aufgabe als Nachschlagewerk **auf dem Feld** und erfasst den
Trainingsfortschritt (Durchführungen mit Datum und Namen statt
Papier-Unterschriften).

**Nutzungskontext:** draußen, oft offline, auf Handy/Tablet. Ein angehender
Drohnensteuerer + ein Luftraumbeobachter (LRB) trainieren gemeinsam.

**Nicht-Ziele (YAGNI):** kein Backend, kein Login, keine Mehrgeräte-Sync, keine
echte Touch-Unterschrift, kein PDF-Export (bewusst später; Datenmodell hält den
Weg offen).

## 2. Architektur & Stack

- **React + Vite** als Frontend.
- **`vite-plugin-pwa`** → Service Worker, Offline-Fähigkeit, installierbar
  („Zum Startbildschirm hinzufügen").
- **Kein Backend.** Persistenz lokal im Browser über `localStorage`, gekapselt
  in einem `useLocalStorage`-Hook mit Schema-Versionierung.
- **Statisches Hosting** (z. B. GitHub Pages / Netlify) — reines Frontend-Bundle.
- **Sprache:** durchgehend Deutsch (UI-Texte, Inhalte).

## 3. Inhalt & Datenmodell

### 3.1 Statische Aufgaben-Daten (`src/data/tasks.ts`)

Die 24 Aufgaben werden **einmalig** aus der Transkription in eine typisierte
Datenstruktur überführt. Diese Daten sind read-only (App-Inhalt), getrennt vom
veränderlichen Nutzerfortschritt.

```ts
type Aufgabe = {
  id: string;                 // z. B. "1-3"
  teil: 1 | 2 | 3;
  nummer: string;             // "1.3"
  titel: string;              // "Fliegen auf gerader Linie"
  schritte: string[];         // nummerierte Handlungsschritte
  lernziel: string;           // "Durch diese Übung … / In dieser Aufgabe …"
  durchfuehrungshinweise: string[];
  sicherheitshinweise: string[]; // die fett markierten Warnungen, ggf. leer
  zielanzahlDefault: number;  // Default-Pflichtzahl (Schätzung, editierbar)
};
```

### 3.2 Aufgaben-Index (Scope)

**Teil 1 – Grundlegende Steuerung (9):** 1.1 Schwebeflug · 1.2 Landung ·
1.3 Gerade Linie · 1.4 Rechteck · 1.5 U-Turn · 1.6 Ziel umkreisen ·
1.7 Position anfliegen · 1.8 Liegende Acht · 1.9 Komplette Selbstumrundung.

**Teil 2 – Sichere Steuerung in einsatznahen Situationen (10):**
2.1 Steuerungssoftware & Flugmodi · 2.2 Liegende Acht (größere Entfernung) ·
2.3 Selbstumrundung (größere Entfernung) · 2.4 Position in def. Höhe ·
2.5 Sensoren · 2.6 Landung mit Bodeneffektwechsel · 2.7 Landung außerhalb der
Sichtweite (BVLOS) · 2.8 Simulierter GPS-Ausfall · 2.9 BVLOS-Flug · 2.10 Parcours.

**Teil 3 – Training von Einsatzszenarien (5):** 3.1 Personensuche ·
3.2 Einsatzdokumentation · 3.3 Ausleuchten · 3.4 Lastentransport ·
3.5 Begrenzung des Einsatzbereichs.

### 3.3 Nutzer-Fortschritt (veränderlich, `localStorage`)

```ts
type Durchfuehrung = {
  id: string;               // lokal generiert
  datum: string;            // ISO-Datum, Default = heute
  drohnensteuerer: string;  // Name, darf leer sein
  luftraumbeobachter: string; // Name, darf leer sein
};

type AufgabenFortschritt = {
  zielanzahl: number;       // initial = zielanzahlDefault, editierbar
  durchfuehrungen: Durchfuehrung[];
  nichtAnwendbar: boolean;  // nur sinnvoll für Teil 2/3
};

type AppState = {
  schemaVersion: number;             // für spätere Migrationen
  fortschritt: Record<string, AufgabenFortschritt>; // key = Aufgabe.id
};
```

### 3.4 Status- & Fortschrittslogik (rein, testbar)

- **Status einer Aufgabe:**
  - `nicht-anwendbar` → wenn `nichtAnwendbar === true`.
  - `erledigt` → wenn `durchfuehrungen.length >= zielanzahl` (und nicht n. a.).
  - sonst `offen`.
- **Aufgaben-Fortschritt:** `min(durchfuehrungen.length, zielanzahl) / zielanzahl`.
- **Gesamt-Fortschritt:** Anzahl `erledigt` / (24 − Anzahl `nicht-anwendbar`).

### 3.5 Pflicht-Anzahl: bewusste Design-Entscheidung

Die Pflicht-Zahl steht im Papier-Leitfaden nur implizit als Anzahl „weißer
Zeilen" und ist aus der Transkription **nicht zuverlässig auszählbar**. Daher:
`zielanzahlDefault` wird pro Aufgabe als **beste Schätzung** (Anzahl der in der
Transkription sichtbaren Tabellenzeilen) gesetzt und ist in der App **pro
Aufgabe editierbar**. So existiert eine feste Zielzahl, ohne falsche Genauigkeit
zu behaupten. Aufgaben ohne sichtbare Zeilen (2.10, 3.1–3.5) starten mit
Default 1.

## 4. UI & Screens

Mobile-first, große Touch-Targets (Outdoor-Bedienung mit Handschuhen denkbar),
DRK-Akzente in Rot/Weiß.

### 4.1 Übersicht / Dashboard
- Kopf mit Gesamt-Fortschrittsbalken („14 / 24 erledigt").
- Drei aufklappbare Sektionen (Teil 1/2/3), je Aufgabe eine **Karte**:
  Nummer + Titel, Status-Badge (offen / erledigt / nicht anwendbar),
  Mini-Fortschritt („3 / 5").
- Tippen auf Karte → Aufgaben-Detail.

### 4.2 Aufgaben-Detail
- **Inhalt (Nachschlagewerk):** Schritte, Lernziel, Durchführungshinweise,
  Sicherheitshinweise hervorgehoben (rotes Warn-Panel).
- **Zielanzahl:** anzeigen + editierbar (Stepper/Eingabe).
- **Durchführungen:** Liste der erfassten Einträge (Datum, beide Namen);
  Button „Durchführung hinzufügen" → Formular (Datum = heute vorbelegt, zwei
  Namensfelder); Einträge löschbar.
- **Teil 2/3:** Schalter „nicht anwendbar".

## 5. Fehlerfälle & Edge Cases

- `localStorage` nicht verfügbar/voll → einmaliger Hinweis-Banner; App bleibt
  bedienbar (nur ohne Speichern).
- **Schema-Versionierung:** `schemaVersion` erlaubt verlustfreie Migration bei
  späteren Updates; unbekannte/höhere Version → defensiv nicht überschreiben.
- Leere Namensfelder erlaubt (Datum genügt zum Zählen), sanfter optionaler
  Hinweis.
- `zielanzahl` minimal 1 (kein Division-durch-0, kein „0 / 0").
- Löschen einer Durchführung mit kurzer Bestätigung.

## 6. Projektstruktur (Vorschlag)

```
src/
  data/tasks.ts            # 24 Aufgaben (statisch)
  domain/progress.ts       # reine Status-/Fortschrittslogik
  hooks/useLocalStorage.ts # persistenter State + Migration
  hooks/useFortschritt.ts  # App-State-API (add/remove/setZiel/toggleNA)
  components/…              # Dashboard, TaskCard, TaskDetail, DurchfuehrungForm
  App.tsx, main.tsx
```

## 7. Testing

- **Vitest** für `domain/progress.ts` (Status-Ableitung, Fortschritt,
  Gesamtberechnung inkl. „nicht anwendbar") und `useLocalStorage`
  (Persistenz, Migration, Fallback ohne Storage).
- **React Testing Library** Smoke-Tests: Aufgaben-Detail rendert Inhalt,
  „Durchführung hinzufügen" erhöht Zähler/Status, „nicht anwendbar" blendet
  Zähler korrekt aus.

## 8. Offene Punkte / spätere Erweiterungen (out of scope)

- PDF-/Daten-Export für offizielle Dokumentation.
- Echte Touch-Unterschrift.
- Mehrere Trainee-Profile pro Gerät.
- Inhaltliche Korrektur der `zielanzahlDefault`-Werte gegen das Originaldokument.
