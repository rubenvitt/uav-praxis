import * as client from 'openid-client';
import { env } from '../env.ts';
import { getDb } from '../db/client.ts';
import { HttpError } from '../http.ts';

/**
 * PocketID via openid-client v6 (Discovery, PKCE S256, Callback).
 * Die Configuration wird lazy beim ersten Bedarf geladen (niemals beim
 * Modul-Laden), damit Dev/Test ohne OIDC funktionieren.
 */

let configPromise: Promise<client.Configuration> | null = null;

function oidcAktivOderFehler(): void {
  if (!env.oidcEnabled) {
    throw new HttpError(
      503,
      'oidc_disabled',
      'Admin-Login (OIDC) ist nicht konfiguriert.',
    );
  }
}

async function getConfig(): Promise<client.Configuration> {
  oidcAktivOderFehler();
  if (!configPromise) {
    configPromise = client.discovery(
      new URL(env.OIDC_ISSUER!),
      env.OIDC_CLIENT_ID!,
      env.OIDC_CLIENT_SECRET!,
    );
  }
  return configPromise;
}

/**
 * Baut die Authorization-URL (PKCE S256). state, nonce und code_verifier werden
 * in oidc_states gespeichert und im Callback geprüft.
 */
export async function authorizationUrl(): Promise<string> {
  const config = await getConfig();

  const codeVerifier = client.randomPKCECodeVerifier();
  const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
  const state = client.randomState();
  const nonce = client.randomNonce();

  getDb()
    .prepare(
      `INSERT INTO oidc_states (state, code_verifier, nonce, created_at)
       VALUES (?, ?, ?, ?)`,
    )
    .run(state, codeVerifier, nonce, new Date().toISOString());

  const url = client.buildAuthorizationUrl(config, {
    redirect_uri: env.OIDC_REDIRECT_URI!,
    scope: 'openid email profile',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
    nonce,
  });

  return url.href;
}

export interface OidcUser {
  sub: string;
  email: string | null;
  name: string | null;
}

interface OidcStateRow {
  state: string;
  code_verifier: string;
  nonce: string;
}

/**
 * Tauscht den Callback-Code gegen Tokens, validiert id_token (state + nonce) und
 * liefert den validierten User. Verbraucht den gespeicherten oidc_state.
 */
export async function handleCallback(currentUrl: string): Promise<OidcUser> {
  const config = await getConfig();
  const url = new URL(currentUrl);
  const state = url.searchParams.get('state');
  if (!state) {
    throw new HttpError(400, 'oidc_state_missing', 'OIDC-State fehlt im Callback.');
  }

  const db = getDb();
  const row = db
    .prepare(`SELECT state, code_verifier, nonce FROM oidc_states WHERE state = ?`)
    .get(state) as OidcStateRow | undefined;
  if (!row) {
    throw new HttpError(400, 'oidc_state_unknown', 'Unbekannter oder abgelaufener OIDC-State.');
  }
  // State ist Einmal-Gebrauch.
  db.prepare(`DELETE FROM oidc_states WHERE state = ?`).run(state);

  let tokens;
  try {
    tokens = await client.authorizationCodeGrant(config, url, {
      pkceCodeVerifier: row.code_verifier,
      expectedState: row.state,
      expectedNonce: row.nonce,
      idTokenExpected: true,
    });
  } catch (e) {
    throw new HttpError(
      401,
      'oidc_exchange_failed',
      `OIDC-Token-Austausch fehlgeschlagen: ${(e as Error).message}`,
    );
  }

  const claims = tokens.claims();
  if (!claims?.sub) {
    throw new HttpError(401, 'oidc_no_subject', 'OIDC-Antwort ohne subject.');
  }

  const email = typeof claims.email === 'string' ? claims.email : null;
  const name =
    typeof claims.name === 'string'
      ? claims.name
      : typeof claims.preferred_username === 'string'
        ? claims.preferred_username
        : null;

  return { sub: claims.sub, email, name };
}

/** Räumt abgelaufene OIDC-States auf (älter als 10 Minuten). */
export function oidcStatesAufraeumen(): void {
  const grenze = new Date(Date.now() - 10 * 60_000).toISOString();
  getDb().prepare(`DELETE FROM oidc_states WHERE created_at < ?`).run(grenze);
}
