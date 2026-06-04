import { createFileRoute, Link, Outlet } from '@tanstack/react-router';
import { useAuth } from '../auth/AuthContext';
import { AdminLogin } from '../admin/AdminLogin';
import '../admin/admin.css';

export const Route = createFileRoute('/admin')({
  component: AdminLayout,
});

/**
 * Admin-Layout: Kopf + Navigation + verschachteltes Routing über <Outlet/>.
 * Login-Gate render-seitig über useAuth (kein beforeLoad-Redirect → kein
 * Aufblitzen der Login-Seite während `laden`). Nur online (kein Offline-Sync).
 */
function AdminLayout() {
  const { identity, laden, logout } = useAuth();

  if (laden) {
    return <div className="admin-laden">Wird geladen …</div>;
  }
  if (identity.kind !== 'admin') {
    return <AdminLogin />;
  }

  return (
    <div className="admin">
      <header className="admin-kopf">
        <div className="admin-titel">
          <p className="eyebrow">Verwaltung</p>
          <h1>Drohnen-Trainingsbegleiter</h1>
        </div>
        <nav className="admin-nav" aria-label="Admin-Navigation">
          <Link to="/admin/participants" activeProps={{ className: 'aktiv' }}>
            Teilnehmer
          </Link>
          <Link to="/admin/katalog" activeProps={{ className: 'aktiv' }}>
            Aufgabenkatalog
          </Link>
        </nav>
        <div className="admin-konto">
          <span>{identity.name ?? identity.email ?? 'Admin'}</span>
          <button type="button" className="btn btn-klein" onClick={() => void logout()}>
            Abmelden
          </button>
        </div>
      </header>

      <main className="admin-inhalt">
        <Outlet />
      </main>
    </div>
  );
}
