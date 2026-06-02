/**
 * Generierung der Kapitel-Illustrationen (§14) mit fal.ai · nano-banana-2.
 *
 * Aufruf:  pnpm gen:images [--only 1-1,2-3] [--force] [--resolution 1K|2K]
 *
 *  - liest FAL_KEY aus der Umgebung (Abbruch mit klarer Meldung, wenn fehlt),
 *  - iteriert über alle Aufgaben aus src/data/tasks.ts,
 *  - Prompt = BASIS_PROMPT + "\n\nThis image shows: " + MOTIVE[id],
 *  - ruft POST https://fal.run/fal-ai/nano-banana-2 (Header `Authorization: Key …`),
 *  - lädt images[0].url herunter → public/illustrations/<id>.webp,
 *  - idempotent (vorhandene Dateien werden übersprungen, --force erzwingt neu),
 *  - Concurrency 4, Retry mit Backoff.
 *
 * Der FAL_KEY wird nie committet (nur via Env/.env, .env ist gitignored).
 */
import { existsSync, mkdirSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { AUFGABEN } from '../src/data/tasks.ts';
import { BASIS_PROMPT } from './illustration-style.ts';
import { MOTIVE } from './illustration-prompts.ts';

const FAL_URL = 'https://fal.run/fal-ai/nano-banana-2';
const CONCURRENCY = 4;
const MAX_VERSUCHE = 4;

interface Optionen {
  only: Set<string> | null;
  force: boolean;
  resolution: '1K' | '2K';
}

function argumenteLesen(argv: string[]): Optionen {
  const opt: Optionen = { only: null, force: false, resolution: '1K' };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--force') {
      opt.force = true;
    } else if (arg === '--only') {
      const wert = argv[++i] ?? '';
      opt.only = new Set(
        wert
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      );
    } else if (arg === '--resolution') {
      const wert = (argv[++i] ?? '').toUpperCase();
      if (wert !== '1K' && wert !== '2K') {
        throw new Error(`Ungültige --resolution "${wert}" (erlaubt: 1K | 2K).`);
      }
      opt.resolution = wert;
    } else {
      throw new Error(`Unbekanntes Argument: ${arg}`);
    }
  }
  return opt;
}

function schlafen(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

interface FalAntwort {
  images?: { url: string }[];
}

async function bildGenerieren(
  id: string,
  prompt: string,
  key: string,
  resolution: '1K' | '2K',
): Promise<ArrayBuffer> {
  let letzterFehler: unknown = null;
  for (let versuch = 1; versuch <= MAX_VERSUCHE; versuch++) {
    try {
      const res = await fetch(FAL_URL, {
        method: 'POST',
        headers: {
          Authorization: `Key ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          aspect_ratio: '4:3',
          resolution,
          output_format: 'webp',
          num_images: 1,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`fal-API ${res.status} ${res.statusText}: ${text.slice(0, 300)}`);
      }
      const daten = (await res.json()) as FalAntwort;
      const url = daten.images?.[0]?.url;
      if (!url) throw new Error('Antwort enthält keine Bild-URL (images[0].url fehlt).');
      const bildRes = await fetch(url);
      if (!bildRes.ok) {
        throw new Error(`Bild-Download fehlgeschlagen: ${bildRes.status} ${bildRes.statusText}`);
      }
      return await bildRes.arrayBuffer();
    } catch (e) {
      letzterFehler = e;
      if (versuch < MAX_VERSUCHE) {
        const backoff = 1000 * 2 ** (versuch - 1);
        console.warn(
          `  ⚠ ${id}: Versuch ${versuch}/${MAX_VERSUCHE} fehlgeschlagen (${
            e instanceof Error ? e.message : String(e)
          }) — neuer Versuch in ${backoff} ms.`,
        );
        await schlafen(backoff);
      }
    }
  }
  throw letzterFehler instanceof Error ? letzterFehler : new Error(String(letzterFehler));
}

async function main(): Promise<void> {
  const key = process.env.FAL_KEY;
  if (!key) {
    console.error(
      'FAL_KEY fehlt. Setze die Umgebungsvariable (z. B. in .env) und starte erneut:\n' +
        '  FAL_KEY=… pnpm gen:images',
    );
    process.exit(1);
  }

  const opt = argumenteLesen(process.argv.slice(2));
  const zielDir = resolve(process.cwd(), 'public', 'illustrations');
  mkdirSync(zielDir, { recursive: true });

  const aufgaben = AUFGABEN.filter((a) => (opt.only ? opt.only.has(a.id) : true));
  if (opt.only) {
    const fehlend = [...opt.only].filter((id) => !AUFGABEN.some((a) => a.id === id));
    if (fehlend.length) {
      console.warn(`Hinweis: unbekannte IDs in --only ignoriert: ${fehlend.join(', ')}`);
    }
  }

  // Zu generierende Aufgaben ermitteln (Idempotenz).
  const zuTun = aufgaben.filter((a) => {
    const ziel = resolve(zielDir, `${a.id}.webp`);
    if (existsSync(ziel) && !opt.force) {
      console.log(`• ${a.id}: vorhanden — übersprungen.`);
      return false;
    }
    if (!MOTIVE[a.id]) {
      console.warn(`• ${a.id}: kein Motiv in illustration-prompts.ts — übersprungen.`);
      return false;
    }
    return true;
  });

  if (!zuTun.length) {
    console.log('Nichts zu tun (alle Bilder vorhanden oder übersprungen).');
    return;
  }

  console.log(
    `Generiere ${zuTun.length} Bild(er) @ ${opt.resolution}, Concurrency ${CONCURRENCY}…`,
  );

  let index = 0;
  let fehlerAnzahl = 0;
  async function worker(): Promise<void> {
    while (index < zuTun.length) {
      const a = zuTun[index++];
      const prompt = `${BASIS_PROMPT}\n\nThis image shows: ${MOTIVE[a.id]}`;
      try {
        const buffer = await bildGenerieren(a.id, prompt, key!, opt.resolution);
        const ziel = resolve(zielDir, `${a.id}.webp`);
        await writeFile(ziel, Buffer.from(buffer));
        console.log(`✓ ${a.id}: gespeichert → public/illustrations/${a.id}.webp`);
      } catch (e) {
        fehlerAnzahl++;
        console.error(`✗ ${a.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, zuTun.length) }, () => worker()));

  if (fehlerAnzahl) {
    console.error(`\nFertig mit ${fehlerAnzahl} Fehler(n).`);
    process.exit(1);
  }
  console.log('\nAlle Bilder erfolgreich generiert.');
}

void main();
