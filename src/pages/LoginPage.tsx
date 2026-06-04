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
