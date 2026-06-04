import { queryOptions } from '@tanstack/react-query';
import { api } from '../api/client';

/** Wiederverwendbare, getippte Query-Einheiten für die Admin-Online-Fläche. */

export const participantsQuery = queryOptions({
  queryKey: ['admin', 'participants'] as const,
  queryFn: () => api.adminGetParticipants(),
});

export const participantDetailQuery = (id: string) =>
  queryOptions({
    queryKey: ['admin', 'participant', id] as const,
    queryFn: () => api.adminGetParticipantDetail(id),
  });

export const adminTasksQuery = queryOptions({
  queryKey: ['admin', 'tasks'] as const,
  queryFn: () => api.adminGetTasks(),
});
