import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { CourseDTO, ParticipantProgressDTO } from '../../shared/types';
import { api, ApiError } from '../api/client';

/** Kurs-Auswertung: Fortschritts-Tabelle je Teilnehmer + CSV-Export. */
export function ProgressPage() {
  const [params, setParams] = useSearchParams();
  const gewaehlt = params.get('kurs') ?? '';

  const [kurse, setKurse] = useState<CourseDTO[]>([]);
  const [auswertung, setAuswertung] = useState<ParticipantProgressDTO[]>([]);
  const [kurseLaden, setKurseLaden] = useState(true);
  const [laden, setLaden] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const liste = await api.adminGetCourses();
        setKurse(liste);
        if (!gewaehlt && liste.length > 0) {
          setParams({ kurs: liste[0].id }, { replace: true });
        }
      } catch (e) {
        setFehler(e instanceof ApiError ? e.message : 'Kurse konnten nicht geladen werden.');
      } finally {
        setKurseLaden(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ladeAuswertung = useCallback(async (courseId: string) => {
    try {
      setAuswertung(await api.adminGetCourseProgress(courseId));
      setFehler(null);
    } catch (e) {
      setFehler(e instanceof ApiError ? e.message : 'Auswertung konnte nicht geladen werden.');
    } finally {
      setLaden(false);
    }
  }, []);

  useEffect(() => {
    if (!gewaehlt) return;
    void (async () => {
      await ladeAuswertung(gewaehlt);
    })();
  }, [gewaehlt, ladeAuswertung]);

  const aktuellerKurs = kurse.find((k) => k.id === gewaehlt) ?? null;

  return (
    <div>
      <div className="admin-sektion-kopf">
        <h2>Auswertung</h2>
        {gewaehlt && (
          <a
            className="btn btn-primaer"
            href={api.exportUrl(gewaehlt)}
            download
          >
            CSV exportieren
          </a>
        )}
      </div>

      {fehler && (
        <p className="admin-fehler" role="alert">
          {fehler}
        </p>
      )}

      <div className="feld" style={{ maxWidth: 360 }}>
        <label htmlFor="auswertung-kurs">Kurs</label>
        <select
          id="auswertung-kurs"
          className="eingabe"
          value={gewaehlt}
          onChange={(e) => setParams({ kurs: e.target.value }, { replace: true })}
          disabled={kurseLaden || kurse.length === 0}
        >
          {kurse.length === 0 && <option value="">— keine Kurse —</option>}
          {kurse.map((k) => (
            <option key={k.id} value={k.id}>
              {k.name}
              {k.archiviert ? ' (archiviert)' : ''}
            </option>
          ))}
        </select>
      </div>

      {kurseLaden ? (
        <p className="admin-hinweis">Wird geladen …</p>
      ) : !aktuellerKurs ? (
        <p className="admin-leer">Bitte einen Kurs wählen.</p>
      ) : laden ? (
        <p className="admin-hinweis">Wird geladen …</p>
      ) : auswertung.length === 0 ? (
        <p className="admin-leer">Keine Teilnehmer in diesem Kurs.</p>
      ) : (
        <div className="tabelle-umbruch">
          <table className="tabelle">
            <thead>
              <tr>
                <th>Teilnehmer</th>
                <th>Erledigt</th>
                <th>Gesamt</th>
                <th>Quote</th>
              </tr>
            </thead>
            <tbody>
              {auswertung.map((p) => {
                const prozent = Math.round(p.quote * 100);
                return (
                  <tr key={p.participant.id}>
                    <td>{p.participant.name}</td>
                    <td className="num">{p.erledigt}</td>
                    <td className="num">{p.gesamt}</td>
                    <td>
                      <div className="quote-zelle">
                        <div className="quote-balken">
                          <div className="quote-fuell" style={{ width: `${prozent}%` }} />
                        </div>
                        <span className="quote-zahl">{prozent}%</span>
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

export default ProgressPage;
