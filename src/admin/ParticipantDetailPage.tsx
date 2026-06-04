import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { ParticipantDetailDTO, Teil } from '../../shared/types';
import { api, ApiError } from '../api/client';

function magicLink(loginCode: string): string {
  return `${window.location.origin}/login?code=${encodeURIComponent(loginCode)}`;
}

function formatDatum(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('de-DE');
}

const TEIL_TITEL: Record<Teil, string> = {
  1: 'Teil 1',
  2: 'Teil 2',
  3: 'Teil 3',
};

/** Detail-Auswertung eines Teilnehmers: Quoten je Teil, Aufgaben-Aufschlüsselung,
 * Stammdaten bearbeiten, Code/Link, Detail-CSV-Export. */
export function ParticipantDetailPage() {
  const { participantId } = useParams<{ participantId: string }>();
  const navigate = useNavigate();

  const [detail, setDetail] = useState<ParticipantDetailDTO | null>(null);
  const [laden, setLaden] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  const [aktion, setAktion] = useState(false);
  const [kopiert, setKopiert] = useState<string | null>(null);

  const [bearbeiten, setBearbeiten] = useState(false);
  const [name, setName] = useState('');
  const [beginn, setBeginn] = useState('');
  const [aktiv, setAktiv] = useState(true);

  const laden_ = useCallback(async () => {
    if (!participantId) return;
    try {
      const d = await api.adminGetParticipantDetail(participantId);
      setDetail(d);
      setName(d.participant.name);
      setBeginn(d.participant.beginn ?? '');
      setAktiv(d.participant.aktiv);
      setFehler(null);
    } catch (e) {
      setFehler(e instanceof ApiError ? e.message : 'Teilnehmer konnte nicht geladen werden.');
    } finally {
      setLaden(false);
    }
  }, [participantId]);

  useEffect(() => {
    void (async () => {
      await laden_();
    })();
  }, [laden_]);

  const speichern = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!participantId || !name.trim()) return;
    setAktion(true);
    setFehler(null);
    try {
      await api.adminUpdateParticipant(participantId, {
        name: name.trim(),
        beginn: beginn || null,
        aktiv,
      });
      setBearbeiten(false);
      await laden_();
    } catch (err) {
      setFehler(err instanceof ApiError ? err.message : 'Speichern fehlgeschlagen.');
    } finally {
      setAktion(false);
    }
  };

  const codeNeu = async () => {
    if (!participantId || !detail) return;
    if (!window.confirm(`Für „${detail.participant.name}“ einen neuen Login-Code erzeugen? Der alte Code wird ungültig.`)) {
      return;
    }
    setAktion(true);
    setFehler(null);
    try {
      await api.adminUpdateParticipant(participantId, { codeNeu: true });
      await laden_();
    } catch (err) {
      setFehler(err instanceof ApiError ? err.message : 'Code konnte nicht erneuert werden.');
    } finally {
      setAktion(false);
    }
  };

  const loeschen = async () => {
    if (!participantId || !detail) return;
    if (!window.confirm(`Teilnehmer „${detail.participant.name}“ und alle Durchführungen wirklich löschen?`)) {
      return;
    }
    setAktion(true);
    setFehler(null);
    try {
      await api.adminDeleteParticipant(participantId);
      navigate('/admin/participants');
    } catch (err) {
      setFehler(err instanceof ApiError ? err.message : 'Löschen fehlgeschlagen.');
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

  if (!participantId) {
    return <p className="admin-fehler">Kein Teilnehmer ausgewählt.</p>;
  }

  return (
    <div>
      <p className="admin-pfad">
        <Link to="/admin/participants">Teilnehmer</Link> · {detail?.participant.name ?? '…'}
      </p>

      {fehler && (
        <p className="admin-fehler" role="alert">
          {fehler}
        </p>
      )}

      {laden ? (
        <p className="admin-hinweis">Wird geladen …</p>
      ) : !detail ? (
        <p className="admin-leer">Teilnehmer nicht gefunden.</p>
      ) : (
        <>
          <div className="admin-sektion-kopf">
            <h2>{detail.participant.name}</h2>
            <div className="aktionen">
              <a className="btn" href={api.exportDetailUrl(detail.participant.id)} download>
                Detail-CSV
              </a>
              <button type="button" className="btn" onClick={() => setBearbeiten((v) => !v)}>
                {bearbeiten ? 'Abbrechen' : 'Bearbeiten'}
              </button>
            </div>
          </div>

          {/* Kennzahlen */}
          <div className="karte tn-kopf">
            <div className="tn-kennzahl">
              <span className="tn-kennzahl-wert">{Math.round(detail.quote * 100)}%</span>
              <span className="tn-kennzahl-label">
                {detail.erledigt}/{detail.gesamt} Aufgaben erledigt
              </span>
            </div>
            <dl className="tn-meta">
              <div>
                <dt>Status</dt>
                <dd>
                  <span className={`badge-status${detail.participant.aktiv ? '' : ' inaktiv'}`}>
                    {detail.participant.aktiv ? 'aktiv' : 'inaktiv'}
                  </span>
                </dd>
              </div>
              <div>
                <dt>Beginn</dt>
                <dd>{detail.participant.beginn ?? '—'}</dd>
              </div>
              <div>
                <dt>Letzte Aktivität</dt>
                <dd>{formatDatum(detail.letzteAktivitaet)}</dd>
              </div>
              <div>
                <dt>Login-Code</dt>
                <dd>
                  <div className="code-zelle">
                    <span className="code-wert">{detail.participant.loginCode}</span>
                    <button
                      type="button"
                      className="btn btn-klein"
                      onClick={() => void kopieren(detail.participant.loginCode, 'code')}
                    >
                      {kopiert === 'code' ? 'Kopiert' : 'Kopieren'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-klein"
                      onClick={() => void kopieren(magicLink(detail.participant.loginCode), 'link')}
                    >
                      {kopiert === 'link' ? 'Kopiert' : 'Link'}
                    </button>
                  </div>
                </dd>
              </div>
            </dl>
          </div>

          {bearbeiten && (
            <form className="karte" onSubmit={speichern}>
              <h3>Stammdaten bearbeiten</h3>
              <div className="feld-reihe" style={{ alignItems: 'flex-end' }}>
                <div className="feld" style={{ flex: '1 1 200px' }}>
                  <label htmlFor="edit-name">Name</label>
                  <input
                    id="edit-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="feld">
                  <label htmlFor="edit-beginn">Beginn</label>
                  <input
                    id="edit-beginn"
                    type="date"
                    value={beginn}
                    onChange={(e) => setBeginn(e.target.value)}
                  />
                </div>
                <label className="check-zeile">
                  <input type="checkbox" checked={aktiv} onChange={(e) => setAktiv(e.target.checked)} />
                  aktiv
                </label>
              </div>
              <div className="formular-aktionen">
                <button type="submit" className="btn btn-primaer" disabled={aktion || !name.trim()}>
                  Speichern
                </button>
                <button type="button" className="btn" onClick={() => void codeNeu()} disabled={aktion}>
                  Code neu
                </button>
                <button
                  type="button"
                  className="btn btn-gefahr"
                  onClick={() => void loeschen()}
                  disabled={aktion}
                >
                  Löschen
                </button>
              </div>
            </form>
          )}

          {/* Fortschritt je Teil */}
          {detail.teile.length > 0 && (
            <div className="karte">
              <h3>Fortschritt je Teil</h3>
              <div className="teil-balken-liste">
                {detail.teile.map((s) => (
                  <div key={s.teil} className="teil-balken">
                    <span className="teil-balken-label">{TEIL_TITEL[s.teil]}</span>
                    <div className="quote-balken">
                      <div className="quote-fuell" style={{ width: `${Math.round(s.quote * 100)}%` }} />
                    </div>
                    <span className="teil-balken-zahl">
                      {s.erledigt}/{s.gesamt} · {Math.round(s.quote * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Aufgaben-Aufschlüsselung */}
          <div className="karte">
            <h3>Aufgaben</h3>
            {detail.aufgaben.length === 0 ? (
              <p className="admin-leer">Keine aktiven Aufgaben im Katalog.</p>
            ) : (
              // Über alle vorhandenen Teile gruppieren (nicht nur die mit anwendbaren
              // Aufgaben) — sonst verschwände ein komplett „nicht anwendbar"-Teil.
              ([1, 2, 3] as Teil[])
                .filter((teil) => detail.aufgaben.some((a) => a.teil === teil))
                .map((teil) => (
                  <div key={teil} className="aufgaben-gruppe">
                    <h4 className="aufgaben-gruppe-titel">{TEIL_TITEL[teil]}</h4>
                    <ul className="aufgaben-liste">
                      {detail.aufgaben
                        .filter((a) => a.teil === teil)
                        .map((a) => (
                        <li
                          key={a.taskId}
                          className={`aufgabe-zeile${a.nichtAnwendbar ? ' nicht-anwendbar' : a.erledigt ? ' erledigt' : ''}`}
                        >
                          <span className="aufgabe-marker" aria-hidden="true">
                            {a.nichtAnwendbar ? '–' : a.erledigt ? '✓' : '✗'}
                          </span>
                          <span className="aufgabe-name">
                            <span className="aufgabe-nummer">{a.nummer}</span> {a.titel}
                          </span>
                          {a.nichtAnwendbar ? (
                            <span className="badge-status inaktiv">nicht anwendbar</span>
                          ) : (
                            <span className="aufgabe-zahl num">
                              {a.anzahl}/{a.ziel}
                            </span>
                          )}
                        </li>
                      ))}
                  </ul>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default ParticipantDetailPage;
