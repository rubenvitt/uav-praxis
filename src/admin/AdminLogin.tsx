/**
 * Anmeldeseite des Admin-Bereichs. Rein präsentational (kein useAuth, kein fetch),
 * damit sie isoliert testbar ist. Der Button leitet zum serverseitigen
 * PocketID-/OIDC-Login weiter. Ist OIDC auf dem Server nicht konfiguriert,
 * erfolgt keine Weiterleitung — darauf weist der statische Hinweis hin.
 */
export function AdminLogin() {
  const anmelden = () => {
    window.location.assign('/api/auth/admin/login');
  };

  return (
    <div className="admin-login">
      <div className="karte">
        <p className="eyebrow">Verwaltung</p>
        <h1>Drohnen-Trainingsbegleiter</h1>
        <p className="admin-hinweis">
          Bitte mit PocketID anmelden, um Kurse, Teilnehmer und den Aufgabenkatalog zu verwalten.
        </p>
        <button type="button" className="btn btn-primaer" onClick={anmelden}>
          Mit PocketID anmelden
        </button>
        <p className="login-hinweis">
          Erfolgt keine Weiterleitung zur PocketID-Anmeldung, ist OIDC auf dem Server nicht
          konfiguriert. Dann ist der Admin-Login deaktiviert.
        </p>
      </div>
    </div>
  );
}

export default AdminLogin;
