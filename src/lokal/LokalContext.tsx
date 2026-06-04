/* eslint-disable react-refresh/only-export-components --
   Context-Datei: Provider und Hook liegen bewusst zusammen (wie AuthContext).
   Reine Fast-Refresh-DX-Regel. */
import { createContext, useContext, useState, type ReactNode } from 'react';

interface LokalValue {
  /** True, wenn der anonyme lokale Übungsmodus gewählt wurde. */
  lokal: boolean;
  /** Wechselt in den anonymen lokalen Übungsmodus. */
  lokalStarten: () => void;
}

const LokalContext = createContext<LokalValue | null>(null);

/**
 * Hält den `lokal`-Zustand REAKTIV über dem Router. Überlebt Navigation
 * (z. B. /aufgabe/:id und zurück), aber bewusst keinen Reload. Router-Context
 * wäre nicht reaktiv — deshalb ein React-Context-Provider über `RouterProvider`.
 */
export function LokalProvider({ children }: { children: ReactNode }) {
  const [lokal, setLokal] = useState(false);
  return (
    <LokalContext.Provider value={{ lokal, lokalStarten: () => setLokal(true) }}>
      {children}
    </LokalContext.Provider>
  );
}

/** Zugriff auf den Lokal-Modus. Wirft außerhalb von `LokalProvider`. */
export function useLokal(): LokalValue {
  const ctx = useContext(LokalContext);
  if (!ctx) throw new Error('useLokal muss innerhalb von LokalProvider verwendet werden');
  return ctx;
}
