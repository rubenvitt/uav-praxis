import { useCallback, useEffect, useState } from 'react';
import type { ParticipantDTO, ParticipantProgressDTO } from '../../shared/types';
import { api, ApiError } from '../api/client';

interface Props {
  courseId: string;
}

function magicLink(loginCode: string): string {
  return `${window.location.origin}/login?code=${encodeURIComponent(loginCode)}`;
}

/** Teilnehmer eines Kurses: anlegen, bearbeiten, löschen, Code/Magic-Link kopieren,
 * Fortschritt je Teilnehmer (erledigt/gesamt/Quote). */
export function ParticipantsPanel({ courseId }: Props) {
  const [teilnehmer, setTeilnehmer] = useState<ParticipantDTO[]>([]);
  const [fortschritt, setFortschritt] = useState<Record<string, ParticipantProgressDTO>>({});
  const [laden, setLaden] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  const [aktion, setAktion] = useState(false);

  const [neuName, setNeuName] = useState('');
  const [bearbeiteId, setBearbeiteId] = useState<string | null>(null);
  const [bearbeiteName, setBearbeiteName] = useState('');
  const [bearbeiteAktiv, setBearbeiteAktiv] = useState(true);
  const [kopiert, setKopiert] = useState<string | null>(null);

  const laden_ = useCallback(async () => {
    try {
      const [liste, progress] = await Promise.all([
        api.adminGetParticipants(courseId),
        api.adminGetCourseProgress(courseId),
      ]);
      setTeilnehmer(liste);
      const map: Record<string, ParticipantProgressDTO> = {};
      for (const p of progress) map[p.participant.id] = p;
      setFortschritt(map);
      setFehler(null);
    } catch (e) {
      setFehler(
        e instanceof ApiError ? e.message : 'Teilnehmer konnten nicht geladen werden.',
      );
    } finally {
      setLaden(false);
    }
  }, [courseId]);

  useEffect(() => {
    void (async () => {
      await laden_();
    })();
  }, [laden_]);

  const anlegen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!neuName.trim()) return;
    setAktion(true);
    setFehler(null);
    try {
      await api.adminCreateParticipant(courseId, neuName.trim());
      setNeuName('');
      await laden_();
    } catch (err) {
      setFehler(err instanceof ApiError ? err.message : 'Teilnehmer konnte nicht angelegt werden.');
    } finally {
      setAktion(false);
    }
  };

  const bearbeitenStarten = (t: ParticipantDTO) => {
    setBearbeiteId(t.id);
    setBearbeiteName(t.name);
    setBearbeiteAktiv(t.aktiv);
  };

  const speichern = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bearbeiteId || !bearbeiteName.trim()) return;
    setAktion(true);
    setFehler(null);
    try {
      await api.adminUpdateParticipant(bearbeiteId, {
        name: bearbeiteName.trim(),
        aktiv: bearbeiteAktiv,
      });
      setBearbeiteId(null);
      await laden_();
    } catch (err) {
      setFehler(err instanceof ApiError ? err.message : 'Teilnehmer konnte nicht gespeichert werden.');
    } finally {
      setAktion(false);
    }
  };

  const codeNeu = async (t: ParticipantDTO) => {
    if (!window.confirm(`Für „${t.name}“ einen neuen Login-Code erzeugen? Der alte Code wird ungültig.`)) {
      return;
    }
    setAktion(true);
    setFehler(null);
    try {
      await api.adminUpdateParticipant(t.id, { codeNeu: true });
      await laden_();
    } catch (err) {
      setFehler(err instanceof ApiError ? err.message : 'Code konnte nicht erneuert werden.');
    } finally {
      setAktion(false);
    }
  };

  const loeschen = async (t: ParticipantDTO) => {
    if (!window.confirm(`Teilnehmer „${t.name}“ wirklich löschen?`)) return;
    setAktion(true);
    setFehler(null);
    try {
      await api.adminDeleteParticipant(t.id);
      await laden_();
    } catch (err) {
      setFehler(err instanceof ApiError ? err.message : 'Teilnehmer konnte nicht gelöscht werden.');
    } finally {
      setAktion(false);
    }
  };

  const kopieren = async (text: string, markierung: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        window.prompt('Zum Kopieren markieren:', text);
      }
      setKopiert(markierung);
      window.setTimeout(() => setKopiert((m) => (m === markierung ? null : m)), 1800);
    } catch {
      window.prompt('Zum Kopieren markieren:', text);
    }
  };

  return (
    <div className="karte">
      <h3>Teilnehmer</h3>

      {fehler && (
        <p className="admin-fehler" role="alert">
          {fehler}
        </p>
      )}

      <form className="feld-reihe" onSubmit={anlegen} style={{ alignItems: 'flex-end' }}>
        <div className="feld" style={{ flex: '1 1 200px', marginBottom: 0 }}>
          <label htmlFor="tn-name">Name</label>
          <input
            id="tn-name"
            type="text"
            value={neuName}
            onChange={(e) => setNeuName(e.target.value)}
            placeholder="Name des Teilnehmers"
          />
        </div>
        <button type="submit" className="btn btn-primaer" disabled={aktion || !neuName.trim()}>
          Teilnehmer anlegen
        </button>
      </form>

      {laden ? (
        <p className="admin-hinweis" style={{ marginTop: 16 }}>
          Wird geladen …
        </p>
      ) : teilnehmer.length === 0 ? (
        <p className="admin-leer">Noch keine Teilnehmer in diesem Kurs.</p>
      ) : (
        <div className="tabelle-umbruch" style={{ marginTop: 16 }}>
          <table className="tabelle">
            <thead>
              <tr>
                <th>Name</th>
                <th>Login-Code</th>
                <th>Magic-Link</th>
                <th>Fortschritt</th>
                <th>Status</th>
                <th aria-label="Aktionen" />
              </tr>
            </thead>
            <tbody>
              {teilnehmer.map((t) => {
                const p = fortschritt[t.id];
                const quote = p ? Math.round(p.quote * 100) : 0;
                const link = magicLink(t.loginCode);
                if (bearbeiteId === t.id) {
                  return (
                    <tr key={t.id}>
                      <td colSpan={6}>
                        <form className="feld-reihe" onSubmit={speichern} style={{ alignItems: 'flex-end' }}>
                          <div className="feld" style={{ flex: '1 1 200px', marginBottom: 0 }}>
                            <label htmlFor={`tn-edit-${t.id}`}>Name</label>
                            <input
                              id={`tn-edit-${t.id}`}
                              type="text"
                              value={bearbeiteName}
                              onChange={(e) => setBearbeiteName(e.target.value)}
                              required
                            />
                          </div>
                          <label className="check-zeile">
                            <input
                              type="checkbox"
                              checked={bearbeiteAktiv}
                              onChange={(e) => setBearbeiteAktiv(e.target.checked)}
                            />
                            aktiv
                          </label>
                          <button
                            type="submit"
                            className="btn btn-primaer"
                            disabled={aktion || !bearbeiteName.trim()}
                          >
                            Speichern
                          </button>
                          <button type="button" className="btn" onClick={() => setBearbeiteId(null)}>
                            Abbrechen
                          </button>
                        </form>
                      </td>
                    </tr>
                  );
                }
                return (
                  <tr key={t.id} className={t.aktiv ? undefined : 'zeile-inaktiv'}>
                    <td>{t.name}</td>
                    <td>
                      <div className="code-zelle">
                        <span className="code-wert">{t.loginCode}</span>
                        <button
                          type="button"
                          className="btn btn-klein"
                          onClick={() => void kopieren(t.loginCode, `code-${t.id}`)}
                        >
                          {kopiert === `code-${t.id}` ? 'Kopiert' : 'Kopieren'}
                        </button>
                      </div>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-klein"
                        onClick={() => void kopieren(link, `link-${t.id}`)}
                      >
                        {kopiert === `link-${t.id}` ? 'Kopiert' : 'Link kopieren'}
                      </button>
                    </td>
                    <td>
                      <div className="quote-zelle">
                        <div className="quote-balken">
                          <div className="quote-fuell" style={{ width: `${quote}%` }} />
                        </div>
                        <span className="quote-zahl">
                          {p ? `${p.erledigt}/${p.gesamt}` : '—'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge-status${t.aktiv ? '' : ' inaktiv'}`}>
                        {t.aktiv ? 'aktiv' : 'inaktiv'}
                      </span>
                    </td>
                    <td>
                      <div className="aktionen">
                        <button
                          type="button"
                          className="btn btn-klein"
                          onClick={() => bearbeitenStarten(t)}
                          disabled={aktion}
                        >
                          Bearbeiten
                        </button>
                        <button
                          type="button"
                          className="btn btn-klein"
                          onClick={() => void codeNeu(t)}
                          disabled={aktion}
                        >
                          Code neu
                        </button>
                        <button
                          type="button"
                          className="btn btn-klein btn-gefahr"
                          onClick={() => void loeschen(t)}
                          disabled={aktion}
                        >
                          Löschen
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default ParticipantsPanel;
