import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { CourseDTO } from '../../shared/types';
import { api, ApiError } from '../api/client';
import { ParticipantsPanel } from './ParticipantsPanel';

/** Detailseite eines Kurses: Stammdaten + Teilnehmerverwaltung (ParticipantsPanel). */
export function CourseDetailPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const [kurs, setKurs] = useState<CourseDTO | null>(null);
  const [laden, setLaden] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);

  const ladeKurs = useCallback(async () => {
    if (!courseId) return;
    try {
      // Es gibt keinen Einzel-Endpunkt; den Kurs aus der Liste ermitteln.
      const alle = await api.adminGetCourses();
      setKurs(alle.find((k) => k.id === courseId) ?? null);
      setFehler(null);
    } catch (e) {
      setFehler(e instanceof ApiError ? e.message : 'Kurs konnte nicht geladen werden.');
    } finally {
      setLaden(false);
    }
  }, [courseId]);

  useEffect(() => {
    void (async () => {
      await ladeKurs();
    })();
  }, [ladeKurs]);

  if (!courseId) {
    return <p className="admin-fehler">Kein Kurs ausgewählt.</p>;
  }

  return (
    <div>
      <p className="admin-pfad">
        <Link to="/admin/courses">Kurse</Link> · {kurs?.name ?? '…'}
      </p>

      <div className="admin-sektion-kopf">
        <h2>{kurs?.name ?? 'Kurs'}</h2>
        <Link className="btn" to={`/admin/auswertung?kurs=${courseId}`}>
          Zur Auswertung
        </Link>
      </div>

      {fehler && (
        <p className="admin-fehler" role="alert">
          {fehler}
        </p>
      )}

      {laden ? (
        <p className="admin-hinweis">Wird geladen …</p>
      ) : !kurs ? (
        <p className="admin-leer">Kurs nicht gefunden.</p>
      ) : (
        <>
          {(kurs.beschreibung || kurs.beginn || kurs.archiviert) && (
            <div className="karte">
              {kurs.beginn && (
                <p className="admin-hinweis">
                  <strong>Beginn:</strong> {kurs.beginn}
                </p>
              )}
              {kurs.beschreibung && <p className="admin-hinweis">{kurs.beschreibung}</p>}
              {kurs.archiviert && <span className="badge-status archiviert">archiviert</span>}
            </div>
          )}
          <ParticipantsPanel courseId={courseId} />
        </>
      )}
    </div>
  );
}

export default CourseDetailPage;
