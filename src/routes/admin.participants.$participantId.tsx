import { createFileRoute } from '@tanstack/react-router';
import { ParticipantDetailPage } from '../admin/ParticipantDetailPage';

export const Route = createFileRoute('/admin/participants/$participantId')({
  component: ParticipantDetailRoute,
});

function ParticipantDetailRoute() {
  const { participantId } = Route.useParams();
  return <ParticipantDetailPage participantId={participantId} />;
}
