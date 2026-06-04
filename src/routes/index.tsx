import { createFileRoute } from '@tanstack/react-router';
import { useAuth } from '../auth/AuthContext';
import { useLokal } from '../lokal/LokalContext';
import { TeilnehmerApp } from '../pages/TeilnehmerApp';
import { StartPage } from '../pages/StartPage';

export const Route = createFileRoute('/')({
  component: HomeRoute,
});

/**
 * Startseite (/): Teilnehmer-Dashboard, sobald ein Teilnehmer eingeloggt ist oder
 * der anonyme lokale Übungsmodus gewählt wurde; sonst die Zugangsauswahl. Während
 * `/api/me` initial lädt, wird nichts gezeigt, damit für eingeloggte Teilnehmer
 * nicht kurz die Auswahl aufblitzt.
 */
function HomeRoute() {
  const { identity, laden } = useAuth();
  const { lokal, lokalStarten } = useLokal();
  if (identity.kind === 'participant' || lokal) return <TeilnehmerApp />;
  if (laden) return <main className="app" aria-busy="true" />;
  return <StartPage onLokalStart={lokalStarten} />;
}
