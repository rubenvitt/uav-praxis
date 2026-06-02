import type { ExecutionDTO, TaskDTO, TaskStatusDTO } from '../../shared/types';

/** Ein noch nicht synchronisierter Mutationseintrag. */
export type QueueEintrag =
  | { art: 'execution'; daten: ExecutionDTO }
  | { art: 'taskStatus'; daten: TaskStatusDTO };

/**
 * Lokaler Cache (localStorage): Katalog, Fortschritt und Mutations-Queue.
 * Vollständige Implementierung folgt im Frontend-Schritt.
 */
export const localStore = {
  tasksLesen(): TaskDTO[] | null {
    throw new Error('not implemented');
  },
  tasksSchreiben(_tasks: TaskDTO[]): void {
    throw new Error('not implemented');
  },
  queueLesen(): QueueEintrag[] {
    throw new Error('not implemented');
  },
  queueAnfuegen(_eintrag: QueueEintrag): void {
    throw new Error('not implemented');
  },
  queueLeeren(): void {
    throw new Error('not implemented');
  },
  lastSyncLesen(): string | null {
    throw new Error('not implemented');
  },
  lastSyncSchreiben(_serverTime: string): void {
    throw new Error('not implemented');
  },
};
