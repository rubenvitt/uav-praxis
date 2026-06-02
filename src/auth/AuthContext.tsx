import { createContext, useContext, type ReactNode } from 'react';
import type { Identity } from '../../shared/types';

export interface AuthContextValue {
  identity: Identity;
  laden: boolean;
  loginMitCode: (code: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Stellt die eingeloggte Identität (Teilnehmer | Admin | anon) bereit.
 * Vollständige Implementierung (Laden via /api/me, Login/Logout) folgt im
 * Frontend-Schritt.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const value: AuthContextValue = {
    identity: { kind: 'anon' },
    laden: false,
    loginMitCode: async () => {
      throw new Error('not implemented');
    },
    logout: async () => {
      throw new Error('not implemented');
    },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth muss innerhalb von AuthProvider verwendet werden');
  return ctx;
}
