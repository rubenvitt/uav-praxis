import type {
  Identity,
  ProgressSnapshot,
  SyncRequest,
  SyncResponse,
  TaskDTO,
} from '../../shared/types';

/** Fehler einer API-Anfrage (mit HTTP-Status und Server-Fehlercode). */
export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

/**
 * fetch-Wrapper für /api/* (Cookies, JSON, Fehlerbehandlung).
 * Vollständige Implementierung folgt im Frontend-Schritt.
 */
export const api = {
  me(): Promise<Identity> {
    throw new Error('not implemented');
  },
  loginParticipant(_code: string): Promise<Identity> {
    throw new Error('not implemented');
  },
  logout(): Promise<void> {
    throw new Error('not implemented');
  },
  tasks(): Promise<TaskDTO[]> {
    throw new Error('not implemented');
  },
  progress(): Promise<ProgressSnapshot> {
    throw new Error('not implemented');
  },
  sync(_req: SyncRequest): Promise<SyncResponse> {
    throw new Error('not implemented');
  },
};
