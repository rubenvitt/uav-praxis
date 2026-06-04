import { createFileRoute } from '@tanstack/react-router';
import { ParticipantsPage } from '../admin/ParticipantsPage';
import { AdminFehler } from '../admin/AdminFehler';
import { participantsQuery } from '../admin/queries';

export const Route = createFileRoute('/admin/participants/')({
  loader: ({ context }) => context.queryClient.ensureQueryData(participantsQuery),
  component: ParticipantsPage,
  errorComponent: AdminFehler,
});
