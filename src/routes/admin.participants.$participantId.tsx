import { createFileRoute } from '@tanstack/react-router';
import { ParticipantDetailPage } from '../admin/ParticipantDetailPage';
import { AdminFehler } from '../admin/AdminFehler';
import { participantDetailQuery } from '../admin/queries';

export const Route = createFileRoute('/admin/participants/$participantId')({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(participantDetailQuery(params.participantId)),
  component: ParticipantDetailRoute,
  errorComponent: AdminFehler,
});

function ParticipantDetailRoute() {
  const { participantId } = Route.useParams();
  return <ParticipantDetailPage participantId={participantId} />;
}
