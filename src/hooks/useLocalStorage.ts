import { useCallback, useEffect, useState } from 'react';

function lesen<T>(key: string, fallback: T): T {
  try {
    const roh = localStorage.getItem(key);
    if (roh == null) return fallback;
    return JSON.parse(roh) as T;
  } catch {
    return fallback;
  }
}

export function useLocalStorage<T>(
  key: string,
  initial: T,
): [T, (next: T) => void, boolean] {
  const [wert, setWert] = useState<T>(() => lesen(key, initial));
  const [speicherfehler, setSpeicherfehler] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(wert));
      setSpeicherfehler(false);
    } catch {
      // Storage nicht verfügbar/voll: State bleibt im Speicher nutzbar.
      setSpeicherfehler(true);
    }
  }, [key, wert]);

  const setzen = useCallback((next: T) => setWert(next), []);
  return [wert, setzen, speicherfehler];
}
