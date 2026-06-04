import { z } from 'zod';

/** Leere Strings als „nicht gesetzt" behandeln (z. B. OIDC im Dev-Betrieb leer). */
const optionalUrl = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined))
  .pipe(z.string().url().optional());

const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined))
  .pipe(z.string().min(1).optional());

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8787),
  PUBLIC_BASE_URL: z.string().url().default('http://localhost:8787'),
  DATABASE_PATH: z.string().min(1).default('./data/app.db'),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET muss mindestens 32 Zeichen lang sein'),
  OIDC_ISSUER: optionalUrl,
  OIDC_CLIENT_ID: optionalText,
  OIDC_CLIENT_SECRET: optionalText,
  OIDC_REDIRECT_URI: optionalUrl,
  ADMIN_ALLOWLIST: z.string().optional(),
  TRUST_PROXY: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const fehler = parsed.error.issues
    .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('\n');
  console.error('Ungültige Server-Konfiguration:\n' + fehler);
  process.exit(1);
}

const raw = parsed.data;

const oidcEnabled = Boolean(
  raw.OIDC_ISSUER && raw.OIDC_CLIENT_ID && raw.OIDC_CLIENT_SECRET && raw.OIDC_REDIRECT_URI,
);

if (!oidcEnabled) {
  console.warn(
    'OIDC ist nicht vollständig konfiguriert (OIDC_ISSUER, OIDC_CLIENT_ID, ' +
      'OIDC_CLIENT_SECRET, OIDC_REDIRECT_URI). Admin-Login ist deaktiviert. ' +
      'Teilnehmer-Login per Code funktioniert weiterhin.',
  );
}

/** Kommagetrennte E-Mail-Allowlist; leeres Array = jeder PocketID-User erlaubt. */
const adminAllowlist = (raw.ADMIN_ALLOWLIST ?? '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter((e) => e.length > 0);

/** Secure-Cookies wenn die öffentliche Basis-URL https nutzt. */
const cookieSecure = raw.PUBLIC_BASE_URL.startsWith('https://');

/**
 * Nur wenn explizit gesetzt, wird dem `x-forwarded-for`-Header vertraut (Betrieb
 * hinter einem Reverse-Proxy). Default false → IP kommt aus der Socket-Verbindung
 * und der Header ist nicht blind spoofbar.
 */
const trustProxy = raw.TRUST_PROXY === 'true';

export const env = {
  PORT: raw.PORT,
  PUBLIC_BASE_URL: raw.PUBLIC_BASE_URL,
  DATABASE_PATH: raw.DATABASE_PATH,
  SESSION_SECRET: raw.SESSION_SECRET,
  OIDC_ISSUER: raw.OIDC_ISSUER,
  OIDC_CLIENT_ID: raw.OIDC_CLIENT_ID,
  OIDC_CLIENT_SECRET: raw.OIDC_CLIENT_SECRET,
  OIDC_REDIRECT_URI: raw.OIDC_REDIRECT_URI,
  adminAllowlist,
  oidcEnabled,
  cookieSecure,
  trustProxy,
} as const;

export type Env = typeof env;
