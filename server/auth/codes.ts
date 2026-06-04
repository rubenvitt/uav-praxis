import { randomInt } from 'node:crypto';

// Crockford-Base32 ohne mehrdeutige Zeichen (kein I, L, O, U).
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * Erzeugt einen Login-Code (Crockford-Base32, 8 Zeichen, ohne mehrdeutige
 * Zeichen). Die Kollisionsprüfung gegen die DB übernimmt der Aufrufer
 * (repo.eindeutigenCodeErzeugen).
 */
export function loginCodeErzeugen(): string {
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += ALPHABET[randomInt(0, ALPHABET.length)];
  }
  return code;
}

/**
 * Normalisiert einen eingegebenen Code: trim, uppercase, Trennzeichen entfernen
 * und gängige Verwechslungen auf das Crockford-Alphabet abbilden
 * (I/L → 1, O → 0, U → V).
 */
export function codeNormalisieren(code: string): string {
  return code
    .trim()
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/[IL]/g, '1')
    .replace(/O/g, '0')
    .replace(/U/g, 'V');
}
