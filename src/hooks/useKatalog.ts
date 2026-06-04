import { useEffect, useState } from 'react';
import type { TaskDTO } from '../../shared/types';
import { api } from '../api/client';
import { localStore } from '../offline/localStore';

/**
 * Liefert den Aufgabenkatalog offline-first: synchron sofort aus dem lokalen
 * Cache bzw. dem Fallback-Katalog (`src/data/tasks.ts`) — also nie leer — und
 * aktualisiert ihn danach im Hintergrund per `GET /api/tasks`.
 *
 * Fehler (z. B. HTTP 401 im anonymen Modus, da `/api/tasks` eine Teilnehmer-/
 * Admin-Session verlangt, oder Offline) werden bewusst verschluckt: der zuletzt
 * gecachte bzw. der Fallback-Katalog bleibt aktiv — kein Spinner, kein Blank-State.
 */
export function useKatalog(): TaskDTO[] {
  const [katalog, setKatalog] = useState<TaskDTO[]>(() => localStore.katalog());

  useEffect(() => {
    let abgebrochen = false;
    api
      .getTasks()
      .then((tasks) => {
        if (abgebrochen || tasks.length === 0) return;
        localStore.tasksSchreiben(tasks);
        setKatalog(tasks);
      })
      .catch(() => {
        // 401 (anon) / Netzfehler / Server offline → Cache bzw. Fallback bleibt.
      });
    return () => {
      abgebrochen = true;
    };
  }, []);

  return katalog;
}
