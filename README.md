# DRK Drohnen-Trainingsbegleiter

Offline-fähige Progressive Web App (PWA) zum Praxisleitfaden „Drohnensteuerer BOS" des Deutschen Roten Kreuzes. Die App begleitet Trainingseinheiten, erfasst Durchlaufzeiten und dokumentiert die Aufgaben gemäß dem offiziellen Leitfaden.

## Voraussetzungen

- [Node.js](https://nodejs.org/) (LTS empfohlen)
- [pnpm](https://pnpm.io/)

## Setup

```bash
pnpm install
```

## Entwicklung

```bash
pnpm dev
```

Startet den Vite-Entwicklungsserver unter `http://localhost:5173`.

## Tests

```bash
pnpm test
```

Führt die Vitest-Testsuite einmalig aus.

## Build

```bash
pnpm build
```

Erstellt einen optimierten Produktions-Build im Verzeichnis `dist/`. Der Service Worker (Workbox) wird dabei automatisch generiert und ermöglicht den Offline-Betrieb.

## Vorschau des Builds

```bash
pnpm preview
```

Startet einen lokalen Preview-Server für den `dist/`-Build.

## Hinweise

- **Zielanzahl pro Aufgabe:** Die `zielanzahlDefault`-Werte pro Aufgabe sind Schätzungen aus der Transkription des Praxisleitfadens und können in der App individuell pro Aufgabe angepasst werden.
- **App-Icons:** Die Icons unter `public/icons/` sind aus der bestehenden `favicon.svg` konvertiert. Bei Bedarf können sie durch das offizielle DRK-Logo ersetzt werden.
