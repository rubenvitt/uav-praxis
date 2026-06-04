import type { ParticipantDTO } from '../../shared/types.ts';
import { repo } from '../db/repo.ts';
import { codeNormalisieren } from './codes.ts';

/**
 * Code-Login: normalisiert den Code, sucht einen aktiven Teilnehmer und liefert
 * ihn (oder null bei ungültigem/inaktivem Code). Setzt bei Erfolg last_seen.
 */
export function teilnehmerPerCodeAnmelden(code: string): ParticipantDTO | null {
  const normalisiert = codeNormalisieren(code);
  if (normalisiert.length === 0) return null;
  const teilnehmer = repo.teilnehmerPerCode(normalisiert);
  if (!teilnehmer) return null;
  repo.teilnehmerGesehen(teilnehmer.id);
  return teilnehmer;
}

// ── Einfaches In-Memory-Rate-Limit pro IP (gegen Code-Bruteforce) ───────────

const FENSTER_MS = 60_000;
const MAX_VERSUCHE = 10;
const versuche = new Map<string, number[]>();

/**
 * Prüft das Rate-Limit für eine IP. Gibt true zurück, wenn der Versuch erlaubt
 * ist, und registriert ihn; false, wenn das Limit (10/min) überschritten wurde.
 */
export function rateLimitErlaubt(ip: string): boolean {
  const jetzt = Date.now();
  const liste = (versuche.get(ip) ?? []).filter((t) => jetzt - t < FENSTER_MS);
  if (liste.length >= MAX_VERSUCHE) {
    versuche.set(ip, liste);
    return false;
  }
  liste.push(jetzt);
  versuche.set(ip, liste);
  return true;
}
