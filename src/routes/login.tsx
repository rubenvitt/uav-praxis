import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { LoginPage } from '../pages/LoginPage';

/**
 * `?code=` typsicher und robust validieren: fehlt/leer ist erlaubt; ein
 * fehlerhaftes Format (z. B. doppeltes `code` → Array) fällt via `.catch` auf
 * `undefined` zurück, statt die Route in einen Fehlerzustand zu zwingen.
 */
const loginSearch = z.object({
  code: z.string().optional().catch(undefined),
});

export const Route = createFileRoute('/login')({
  validateSearch: loginSearch,
  component: LoginRoute,
});

function LoginRoute() {
  const { code } = Route.useSearch();
  return <LoginPage code={code} />;
}
