/**
 * Startseite (/): Wahl des Zugangs. Zwei Wege — Teilnehmer-Login per Code und
 * Verwaltung (Admin/PocketID) — plus ein dezenter Einstieg in den anonymen, rein
 * lokalen Übungsmodus (§9). Wird von der `/`-Route nur angezeigt, solange kein
 * Teilnehmer eingeloggt ist und der lokale Modus nicht gewählt wurde.
 */
import { useNavigate } from 'react-router-dom';

type Props = {
  /** Wechselt in den anonymen lokalen Übungsmodus (Dashboard ohne Anmeldung). */
  onLokalStart: () => void;
};

export function StartPage({ onLokalStart }: Props) {
  const navigate = useNavigate();

  return (
    <main className="app login start">
      <header className="login-kopf">
        <p className="eyebrow">Training · BOS</p>
        <h1>Drohnen-Trainingsbegleiter</h1>
      </header>

      <p className="login-hinweis">Wähle deinen Zugang.</p>

      <div className="start-auswahl">
        <button type="button" className="start-karte" onClick={() => navigate('/login')}>
          <span className="start-karte-icon" aria-hidden="true">
            👤
          </span>
          <span className="start-karte-titel">Teilnehmer</span>
          <span className="start-karte-text">Mit persönlichem Code anmelden</span>
        </button>

        <button type="button" className="start-karte" onClick={() => navigate('/admin')}>
          <span className="start-karte-icon" aria-hidden="true">
            🛠️
          </span>
          <span className="start-karte-titel">Verwaltung</span>
          <span className="start-karte-text">Admin-Login mit PocketID</span>
        </button>
      </div>

      <button type="button" className="start-lokal" onClick={onLokalStart}>
        Ohne Anmeldung üben (lokal)
      </button>
    </main>
  );
}

export default StartPage;
