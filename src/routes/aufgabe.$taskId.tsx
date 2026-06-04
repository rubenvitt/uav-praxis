import { createFileRoute } from '@tanstack/react-router';
import { TeilnehmerApp } from '../pages/TeilnehmerApp';

export const Route = createFileRoute('/aufgabe/$taskId')({
  component: AufgabeRoute,
});

function AufgabeRoute() {
  const { taskId } = Route.useParams();
  return <TeilnehmerApp taskId={taskId} />;
}
