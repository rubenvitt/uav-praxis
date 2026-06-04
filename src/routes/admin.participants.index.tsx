import { createFileRoute } from '@tanstack/react-router';
import { ParticipantsPage } from '../admin/ParticipantsPage';

export const Route = createFileRoute('/admin/participants/')({
  component: ParticipantsPage,
});
