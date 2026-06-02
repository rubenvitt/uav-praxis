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

export function useLocalStorage<T>(key: string, initial: T): [T, (next: T) => void] {
  const [wert, setWert] = useState<T>(() => lesen(key, initial));

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(wert));
    } catch {
      // Storage nicht verfügbar/voll: State bleibt im Speicher nutzbar.
    }
  }, [key, wert]);

  const setzen = useCallback((next: T) => setWert(next), []);
  return [wert, setzen];
}
