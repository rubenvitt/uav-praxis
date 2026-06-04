import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { AdminLogin } from './AdminLogin';
import { ParticipantsPage } from './ParticipantsPage';
import { ParticipantDetailPage } from './ParticipantDetailPage';
import { CatalogPage } from './CatalogPage';
import './admin.css';

/**
 * Admin-Bereich: Layout (Kopf + Navigation) und verschachteltes Routing unter
 * /admin/*. Login-Gate über useAuth: solange geladen wird, Ladeanzeige; ohne
 * Admin-Identität die PocketID-Anmeldung. Nur online (kein Offline-Sync).
 */
export function AdminApp() {
  const { identity, laden, logout } = useAuth();

  if (laden) {
    return <div className="admin-laden">Wird geladen …</div>;
  }

  if (identity.kind !== 'admin') {
    return <AdminLogin />;
  }

  const navKlasse = ({ isActive }: { isActive: boolean }) => (isActive ? 'aktiv' : undefined);

  return (
    <div className="admin">
      <header className="admin-kopf">
        <div className="admin-titel">
          <p className="eyebrow">Verwaltung</p>
          <h1>Drohnen-Trainingsbegleiter</h1>
        </div>
        <nav className="admin-nav" aria-label="Admin-Navigation">
          <NavLink to="/admin/participants" className={navKlasse}>
            Teilnehmer
          </NavLink>
          <NavLink to="/admin/katalog" className={navKlasse}>
            Aufgabenkatalog
          </NavLink>
        </nav>
        <div className="admin-konto">
          <span>{identity.name ?? identity.email ?? 'Admin'}</span>
          <button type="button" className="btn btn-klein" onClick={() => void logout()}>
            Abmelden
          </button>
        </div>
      </header>

      <main className="admin-inhalt">
        <Routes>
          <Route index element={<Navigate to="participants" replace />} />
          <Route path="participants" element={<ParticipantsPage />} />
          <Route path="participants/:participantId" element={<ParticipantDetailPage />} />
          <Route path="katalog" element={<CatalogPage />} />
          <Route path="*" element={<Navigate to="participants" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default AdminApp;
