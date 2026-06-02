/**
 * Push/Pull-Sync, Online-Erkennung, Reconciliation.
 * Vollständige Implementierung folgt im Frontend-Schritt.
 */
export const syncEngine = {
  /** Startet Trigger (App-Start, online-Event, Intervall). Liefert ein Stop-Callback. */
  start(): () => void {
    throw new Error('not implemented');
  },
  /** Führt einen Sync-Durchlauf aus (debounced extern aufgerufen). */
  syncJetzt(): Promise<void> {
    throw new Error('not implemented');
  },
};
