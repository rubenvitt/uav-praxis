import { ApiError } from '../api/client';

/**
 * errorComponent für Admin-Routen. Greift nur für authentifizierte, aber
 * fehlgeschlagene Loader (500/Netzfehler). Der UNAUTH-Fall erreicht diese
 * Komponente nicht: Das Admin-Layout rendert dann <AdminLogin/> statt <Outlet/>,
 * sodass die fehlerhafte Child-Route gar nicht angezeigt wird.
 */
export function AdminFehler({ error }: { error: Error }) {
  const meldung =
    error instanceof ApiError ? error.message : 'Die Daten konnten nicht geladen werden.';
  return (
    <p className="admin-fehler" role="alert">
      {meldung}
    </p>
  );
}

export default AdminFehler;
