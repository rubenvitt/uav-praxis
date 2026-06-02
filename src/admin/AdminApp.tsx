import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { AdminLogin } from './AdminLogin';
import { CoursesPage } from './CoursesPage';
import { CourseDetailPage } from './CourseDetailPage';
import { CatalogPage } from './CatalogPage';
import { ProgressPage } from './ProgressPage';
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
          <NavLink to="/admin/courses" className={navKlasse}>
            Kurse
          </NavLink>
          <NavLink to="/admin/katalog" className={navKlasse}>
            Aufgabenkatalog
          </NavLink>
          <NavLink to="/admin/auswertung" className={navKlasse}>
            Auswertung
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
          <Route index element={<Navigate to="courses" replace />} />
          <Route path="courses" element={<CoursesPage />} />
          <Route path="courses/:courseId" element={<CourseDetailPage />} />
          <Route path="katalog" element={<CatalogPage />} />
          <Route path="auswertung" element={<ProgressPage />} />
          <Route path="*" element={<Navigate to="courses" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default AdminApp;
