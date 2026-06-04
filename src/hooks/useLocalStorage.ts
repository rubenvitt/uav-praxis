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
    let fehler = false;
    try {
      localStorage.setItem(key, JSON.stringify(wert));
    } catch {
      // Storage nicht verfügbar/voll: State bleibt im Speicher nutzbar.
      fehler = true;
    }
    // localStorage ist ein externes System; ob das Schreiben gelingt, lässt sich
    // erst nach dem Versuch (auch beim Mount) feststellen und wird hier als
    // Status zurückgemeldet. Der funktionale Update verhindert Extra-Renders.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSpeicherfehler((vorher) => (vorher === fehler ? vorher : fehler));
  }, [key, wert]);

  const setzen = useCallback((next: T) => setWert(next), []);
  return [wert, setzen, speicherfehler];
}
