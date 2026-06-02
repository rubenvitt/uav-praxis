export type Teil = 1 | 2 | 3;

export interface TaskDTO {
  id: string;
  teil: Teil;
  nummer: string;
  titel: string;
  lernziel: string;
  schritte: string[];
  durchfuehrungshinweise: string[];
  sicherheitshinweise: string[];
  zielanzahlDefault: number;
  sortOrder: number;
  aktiv: boolean;
  bildUrl?: string | null;
}

export interface ExecutionDTO {
  id: string; // client-UUID
  taskId: string;
  datum: string; // yyyy-mm-dd
  drohnensteuerer: string;
  luftraumbeobachter: string;
  deletedAt?: string | null;
}

export interface TaskStatusDTO {
  taskId: string;
  zielanzahl: number | null;
  nichtAnwendbar: boolean;
  updatedAt: string;
}

export interface ProgressSnapshot {
  executions: ExecutionDTO[];
  taskStatus: TaskStatusDTO[];
  serverTime: string;
}

// Sync: Client schiebt seit letztem Sync angefallene Mutationen, Server antwortet
// mit autoritativem Snapshot (Pull).
export interface SyncRequest {
  since: string | null; // letzter erfolgreicher Sync (serverTime) oder null
  executions: ExecutionDTO[]; // Upserts inkl. Tombstones (deletedAt gesetzt)
  taskStatus: TaskStatusDTO[]; // Upserts (last-write-wins via updatedAt)
}
export type SyncResponse = ProgressSnapshot;

export type Identity =
  | { kind: 'anon' }
  | { kind: 'participant'; id: string; name: string; course: { id: string; name: string } }
  | { kind: 'admin'; id: string; name: string | null; email: string | null };

// Admin-DTOs
export interface CourseDTO {
  id: string;
  name: string;
  beschreibung: string | null;
  beginn: string | null;
  archiviert: boolean;
  teilnehmerAnzahl?: number;
}
export interface ParticipantDTO {
  id: string;
  courseId: string;
  name: string;
  loginCode: string;
  aktiv: boolean;
  lastSeen: string | null;
}
export interface ParticipantProgressDTO {
  participant: ParticipantDTO;
  erledigt: number;
  gesamt: number;
  quote: number;
}
