/* eslint-disable react-refresh/only-export-components --
   Context-Datei: der Vertrag (§3) verlangt, dass `useAuth`/`useAuthOptional`
   neben dem Provider in dieser Datei liegen. Reine Fast-Refresh-DX-Regel. */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Identity } from '../../shared/types';
import { api, ApiError } from '../api/client';

export interface AuthContextValue {
  /** Aktuelle Identität (`anon` bis geladen / nicht eingeloggt). */
  identity: Identity;
  /** True, solange `/api/me` initial geladen wird oder ein Login/Logout läuft. */
  laden: boolean;
  /** Fehlermeldung des letzten Login-Versuchs (z. B. ungültiger Code), sonst null. */
  fehler: string | null;
  /** Teilnehmer-Login per Dauer-Code. Wirft bei ungültigem Code (setzt zudem `fehler`). */
  loginMitCode: (code: string) => Promise<void>;
  /** Session beenden → Identität `anon`. */
  logout: () => Promise<void>;
  /** Identität neu von `/api/me` laden. */
  neuLaden: () => Promise<void>;
}

const ANON: Identity = { kind: 'anon' };

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Stellt die eingeloggte Identität (Teilnehmer | Admin | anon) bereit, lädt sie
 * beim Start via `/api/me` und bietet Login/Logout.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [identity, setIdentity] = useState<Identity>(ANON);
  const [laden, setLaden] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);

  const neuLaden = useCallback(async () => {
    setLaden(true);
    try {
      const id = await api.me();
      setIdentity(id);
    } catch {
      // Offline o. Ä.: anon belassen, App funktioniert lokal weiter.
      setIdentity(ANON);
    } finally {
      setLaden(false);
    }
  }, []);

  // Identität beim Start laden. Die setState-Aufrufe erfolgen im async-Callback
  // (nicht synchron im Effekt-Body), Abbruch via ignore bei Unmount.
  useEffect(() => {
    let ignorieren = false;
    void (async () => {
      try {
        const id = await api.me();
        if (!ignorieren) setIdentity(id);
      } catch {
        if (!ignorieren) setIdentity(ANON);
      } finally {
        if (!ignorieren) setLaden(false);
      }
    })();
    return () => {
      ignorieren = true;
    };
  }, []);

  const loginMitCode = useCallback(async (code: string) => {
    setLaden(true);
    setFehler(null);
    try {
      await api.participantLogin(code);
      const id = await api.me();
      setIdentity(id);
    } catch (e) {
      const meldung =
        e instanceof ApiError ? e.message : 'Login fehlgeschlagen. Bitte erneut versuchen.';
      setFehler(meldung);
      throw e;
    } finally {
      setLaden(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setLaden(true);
    try {
      await api.logout();
    } catch {
      // auch bei Fehler lokal abmelden
    } finally {
      setIdentity(ANON);
      setFehler(null);
      setLaden(false);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ identity, laden, fehler, loginMitCode, logout, neuLaden }),
    [identity, laden, fehler, loginMitCode, logout, neuLaden],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Hook für die Auth-Identität. Wirft außerhalb von `AuthProvider`. */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth muss innerhalb von AuthProvider verwendet werden');
  return ctx;
}

/**
 * Nicht-werfender Zugriff auf die Identität (oder `null`, wenn kein Provider).
 * Genutzt von Hooks wie `useFortschritt`, die auch ohne `AuthProvider`
 * (z. B. in bestehenden Tests) lauffähig bleiben müssen.
 */
export function useAuthOptional(): AuthContextValue | null {
  return useContext(AuthContext);
}
