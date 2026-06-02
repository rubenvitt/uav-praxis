import type {
  CourseDTO,
  Identity,
  ParticipantDTO,
  ParticipantProgressDTO,
  ProgressSnapshot,
  SyncRequest,
  SyncResponse,
  TaskDTO,
  Teil,
} from '../../shared/types';

/** Fehler einer API-Anfrage (mit HTTP-Status und Server-Fehlercode). */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

const BASIS = '/api';

interface ServerFehler {
  error?: { code?: string; message?: string };
}

/**
 * Zentraler fetch-Wrapper: Basis `/api`, `credentials: 'include'` (Cookie-Session),
 * JSON-Serialisierung und einheitliches Fehlerschema
 * `{ error: { code, message } }` → wirft `ApiError`.
 */
async function anfrage<T>(
  pfad: string,
  optionen: { method?: string; body?: unknown } = {},
): Promise<T> {
  const init: RequestInit = {
    method: optionen.method ?? 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  };
  if (optionen.body !== undefined) {
    init.body = JSON.stringify(optionen.body);
    init.headers = { ...init.headers, 'Content-Type': 'application/json' };
  }

  let antwort: Response;
  try {
    antwort = await fetch(`${BASIS}${pfad}`, init);
  } catch (e) {
    // Netzfehler (offline o. Ä.) → einheitlich als ApiError mit Status 0.
    throw new ApiError(0, 'network_error', e instanceof Error ? e.message : 'Netzwerkfehler');
  }

  if (!antwort.ok) {
    let code = 'http_error';
    let message = `HTTP ${antwort.status}`;
    try {
      const daten = (await antwort.json()) as ServerFehler;
      if (daten.error?.code) code = daten.error.code;
      if (daten.error?.message) message = daten.error.message;
    } catch {
      // kein JSON-Body — Standardmeldung beibehalten
    }
    throw new ApiError(antwort.status, code, message);
  }

  if (antwort.status === 204) return undefined as T;
  const ct = antwort.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) return undefined as T;
  return (await antwort.json()) as T;
}

// ── Eingabe-Typen für Admin-Mutationen ──────────────────────────────────────
export interface KursEingabe {
  name: string;
  beschreibung?: string | null;
  beginn?: string | null;
}
export interface KursPatch {
  name?: string;
  beschreibung?: string | null;
  beginn?: string | null;
  archiviert?: boolean;
}
export interface TeilnehmerPatch {
  name?: string;
  aktiv?: boolean;
  codeNeu?: boolean;
}
export interface TaskEingabe {
  id?: string;
  teil: Teil;
  nummer: string;
  titel: string;
  lernziel?: string;
  schritte?: string[];
  durchfuehrungshinweise?: string[];
  sicherheitshinweise?: string[];
  zielanzahlDefault?: number;
  sortOrder?: number;
  aktiv?: boolean;
}
export type TaskPatch = Partial<Omit<TaskEingabe, 'id'>>;

/**
 * Typisierter Client für alle `/api`-Endpunkte. Stabile öffentliche Oberfläche
 * für die UI-Agenten (Auth/Login, Teilnehmer-App, Admin-Bereich).
 */
export const api = {
  // ── Auth / Identität ───────────────────────────────────────────────────────
  /** Aktuelle Identität (`anon` | `participant` | `admin`). */
  me(): Promise<Identity> {
    return anfrage<Identity>('/me');
  },

  /**
   * Teilnehmer-Login per Dauer-Code. Setzt serverseitig die Session (Cookie).
   * Wirft `ApiError` (401 `invalid_code`, 429 `rate_limited`) bei Fehlschlag.
   * Die neue Identität bitte anschließend über `me()` laden.
   */
  participantLogin(code: string): Promise<void> {
    return anfrage<void>('/auth/participant', { method: 'POST', body: { code } });
  },

  /** Aktuelle Session beenden (Teilnehmer oder Admin). */
  logout(): Promise<void> {
    return anfrage<void>('/auth/logout', { method: 'POST' });
  },

  // ── Teilnehmer ─────────────────────────────────────────────────────────────
  /** Aktiver Aufgabenkatalog (sortiert). */
  getTasks(): Promise<TaskDTO[]> {
    return anfrage<TaskDTO[]>('/tasks');
  },

  /** Fortschritt-Snapshot des eingeloggten Teilnehmers. */
  getProgress(): Promise<ProgressSnapshot> {
    return anfrage<ProgressSnapshot>('/progress');
  },

  /** Batch-Sync (push + pull). Liefert den autoritativen Server-Snapshot. */
  sync(req: SyncRequest): Promise<SyncResponse> {
    return anfrage<SyncResponse>('/sync', { method: 'POST', body: req });
  },

  // ── Admin: Kurse ───────────────────────────────────────────────────────────
  adminGetCourses(): Promise<CourseDTO[]> {
    return anfrage<CourseDTO[]>('/admin/courses');
  },
  adminCreateCourse(eingabe: KursEingabe): Promise<CourseDTO> {
    return anfrage<CourseDTO>('/admin/courses', { method: 'POST', body: eingabe });
  },
  adminUpdateCourse(id: string, patch: KursPatch): Promise<CourseDTO> {
    return anfrage<CourseDTO>(`/admin/courses/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: patch,
    });
  },
  adminDeleteCourse(id: string): Promise<void> {
    return anfrage<void>(`/admin/courses/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
  adminGetCourseProgress(courseId: string): Promise<ParticipantProgressDTO[]> {
    return anfrage<ParticipantProgressDTO[]>(
      `/admin/courses/${encodeURIComponent(courseId)}/progress`,
    );
  },
  /** URL für den CSV-Export (direkt verlinken/öffnen, kein fetch). */
  exportUrl(courseId: string): string {
    return `${BASIS}/admin/courses/${encodeURIComponent(courseId)}/export`;
  },

  // ── Admin: Teilnehmer ──────────────────────────────────────────────────────
  adminGetParticipants(courseId: string): Promise<ParticipantDTO[]> {
    return anfrage<ParticipantDTO[]>(
      `/admin/courses/${encodeURIComponent(courseId)}/participants`,
    );
  },
  adminCreateParticipant(courseId: string, name: string): Promise<ParticipantDTO> {
    return anfrage<ParticipantDTO>(
      `/admin/courses/${encodeURIComponent(courseId)}/participants`,
      { method: 'POST', body: { name } },
    );
  },
  adminUpdateParticipant(id: string, patch: TeilnehmerPatch): Promise<ParticipantDTO> {
    return anfrage<ParticipantDTO>(`/admin/participants/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: patch,
    });
  },
  adminDeleteParticipant(id: string): Promise<void> {
    return anfrage<void>(`/admin/participants/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  // ── Admin: Aufgabenkatalog ─────────────────────────────────────────────────
  /** Gesamter Katalog inkl. inaktiver Aufgaben. */
  adminGetTasks(): Promise<TaskDTO[]> {
    return anfrage<TaskDTO[]>('/admin/tasks');
  },
  adminCreateTask(eingabe: TaskEingabe): Promise<TaskDTO> {
    return anfrage<TaskDTO>('/admin/tasks', { method: 'POST', body: eingabe });
  },
  adminUpdateTask(id: string, patch: TaskPatch): Promise<TaskDTO> {
    return anfrage<TaskDTO>(`/admin/tasks/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: patch,
    });
  },
  adminDeleteTask(id: string): Promise<void> {
    return anfrage<void>(`/admin/tasks/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
  /** Neue Reihenfolge des Katalogs setzen (Reihenfolge der IDs = sort_order). */
  adminReorderTasks(ids: string[]): Promise<void> {
    return anfrage<void>('/admin/tasks/reorder', { method: 'POST', body: { ids } });
  },
};

export type ApiClient = typeof api;
