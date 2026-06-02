import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { CourseDTO } from '../../shared/types';
import { api, ApiError, type KursEingabe, type KursPatch } from '../api/client';

interface FormZustand {
  name: string;
  beschreibung: string;
  beginn: string;
}

const LEER: FormZustand = { name: '', beschreibung: '', beginn: '' };

function eingabeAus(zustand: FormZustand): KursEingabe {
  return {
    name: zustand.name.trim(),
    beschreibung: zustand.beschreibung.trim() || null,
    beginn: zustand.beginn || null,
  };
}

/** Kurse-Liste mit Anlegen, Bearbeiten, Archivieren und Löschen. */
export function CoursesPage() {
  const [kurse, setKurse] = useState<CourseDTO[]>([]);
  const [laden, setLaden] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);

  const [neu, setNeu] = useState<FormZustand>(LEER);
  const [neuOffen, setNeuOffen] = useState(false);
  const [bearbeiteId, setBearbeiteId] = useState<string | null>(null);
  const [bearbeite, setBearbeite] = useState<FormZustand>(LEER);
  const [aktion, setAktion] = useState(false);

  const ladeKurse = useCallback(async () => {
    try {
      setKurse(await api.adminGetCourses());
      setFehler(null);
    } catch (e) {
      setFehler(e instanceof ApiError ? e.message : 'Kurse konnten nicht geladen werden.');
    } finally {
      setLaden(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await ladeKurse();
    })();
  }, [ladeKurse]);

  const anlegen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!neu.name.trim()) return;
    setAktion(true);
    setFehler(null);
    try {
      await api.adminCreateCourse(eingabeAus(neu));
      setNeu(LEER);
      setNeuOffen(false);
      await ladeKurse();
    } catch (err) {
      setFehler(err instanceof ApiError ? err.message : 'Kurs konnte nicht angelegt werden.');
    } finally {
      setAktion(false);
    }
  };

  const bearbeitenStarten = (kurs: CourseDTO) => {
    setBearbeiteId(kurs.id);
    setBearbeite({
      name: kurs.name,
      beschreibung: kurs.beschreibung ?? '',
      beginn: kurs.beginn ?? '',
    });
  };

  const speichern = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bearbeiteId || !bearbeite.name.trim()) return;
    setAktion(true);
    setFehler(null);
    try {
      const patch: KursPatch = eingabeAus(bearbeite);
      await api.adminUpdateCourse(bearbeiteId, patch);
      setBearbeiteId(null);
      await ladeKurse();
    } catch (err) {
      setFehler(err instanceof ApiError ? err.message : 'Kurs konnte nicht gespeichert werden.');
    } finally {
      setAktion(false);
    }
  };

  const archivierenUmschalten = async (kurs: CourseDTO) => {
    setAktion(true);
    setFehler(null);
    try {
      await api.adminUpdateCourse(kurs.id, { archiviert: !kurs.archiviert });
      await ladeKurse();
    } catch (err) {
      setFehler(err instanceof ApiError ? err.message : 'Aktion fehlgeschlagen.');
    } finally {
      setAktion(false);
    }
  };

  const loeschen = async (kurs: CourseDTO) => {
    if (!window.confirm(`Kurs „${kurs.name}“ und alle Teilnehmer wirklich löschen?`)) return;
    setAktion(true);
    setFehler(null);
    try {
      await api.adminDeleteCourse(kurs.id);
      await ladeKurse();
    } catch (err) {
      setFehler(err instanceof ApiError ? err.message : 'Kurs konnte nicht gelöscht werden.');
    } finally {
      setAktion(false);
    }
  };

  return (
    <div>
      <div className="admin-sektion-kopf">
        <h2>Kurse</h2>
        <button
          type="button"
          className="btn btn-primaer"
          onClick={() => setNeuOffen((v) => !v)}
        >
          {neuOffen ? 'Abbrechen' : 'Kurs anlegen'}
        </button>
      </div>

      {fehler && (
        <p className="admin-fehler" role="alert">
          {fehler}
        </p>
      )}

      {neuOffen && (
        <form className="karte" onSubmit={anlegen}>
          <h3>Neuer Kurs</h3>
          <div className="feld">
            <label htmlFor="kurs-name">Name</label>
            <input
              id="kurs-name"
              type="text"
              value={neu.name}
              onChange={(e) => setNeu({ ...neu, name: e.target.value })}
              required
            />
          </div>
          <div className="feld-reihe">
            <div className="feld">
              <label htmlFor="kurs-beginn">Beginn</label>
              <input
                id="kurs-beginn"
                type="date"
                value={neu.beginn}
                onChange={(e) => setNeu({ ...neu, beginn: e.target.value })}
              />
            </div>
          </div>
          <div className="feld">
            <label htmlFor="kurs-beschr">Beschreibung</label>
            <textarea
              id="kurs-beschr"
              value={neu.beschreibung}
              onChange={(e) => setNeu({ ...neu, beschreibung: e.target.value })}
            />
          </div>
          <div className="formular-aktionen">
            <button type="submit" className="btn btn-primaer" disabled={aktion || !neu.name.trim()}>
              Anlegen
            </button>
          </div>
        </form>
      )}

      {laden ? (
        <p className="admin-hinweis">Wird geladen …</p>
      ) : kurse.length === 0 ? (
        <p className="admin-leer">Noch keine Kurse angelegt.</p>
      ) : (
        <div className="tabelle-umbruch">
          <table className="tabelle">
            <thead>
              <tr>
                <th>Name</th>
                <th>Beginn</th>
                <th>Teilnehmer</th>
                <th>Status</th>
                <th aria-label="Aktionen" />
              </tr>
            </thead>
            <tbody>
              {kurse.map((kurs) =>
                bearbeiteId === kurs.id ? (
                  <tr key={kurs.id}>
                    <td colSpan={5}>
                      <form className="karte" onSubmit={speichern} style={{ margin: 0 }}>
                        <h3>Kurs bearbeiten</h3>
                        <div className="feld">
                          <label htmlFor={`edit-name-${kurs.id}`}>Name</label>
                          <input
                            id={`edit-name-${kurs.id}`}
                            type="text"
                            value={bearbeite.name}
                            onChange={(e) => setBearbeite({ ...bearbeite, name: e.target.value })}
                            required
                          />
                        </div>
                        <div className="feld-reihe">
                          <div className="feld">
                            <label htmlFor={`edit-beginn-${kurs.id}`}>Beginn</label>
                            <input
                              id={`edit-beginn-${kurs.id}`}
                              type="date"
                              value={bearbeite.beginn}
                              onChange={(e) =>
                                setBearbeite({ ...bearbeite, beginn: e.target.value })
                              }
                            />
                          </div>
                        </div>
                        <div className="feld">
                          <label htmlFor={`edit-beschr-${kurs.id}`}>Beschreibung</label>
                          <textarea
                            id={`edit-beschr-${kurs.id}`}
                            value={bearbeite.beschreibung}
                            onChange={(e) =>
                              setBearbeite({ ...bearbeite, beschreibung: e.target.value })
                            }
                          />
                        </div>
                        <div className="formular-aktionen">
                          <button
                            type="submit"
                            className="btn btn-primaer"
                            disabled={aktion || !bearbeite.name.trim()}
                          >
                            Speichern
                          </button>
                          <button
                            type="button"
                            className="btn"
                            onClick={() => setBearbeiteId(null)}
                          >
                            Abbrechen
                          </button>
                        </div>
                      </form>
                    </td>
                  </tr>
                ) : (
                  <tr key={kurs.id} className={kurs.archiviert ? 'zeile-inaktiv' : undefined}>
                    <td>
                      <Link to={`/admin/courses/${kurs.id}`}>{kurs.name}</Link>
                    </td>
                    <td>{kurs.beginn ?? '—'}</td>
                    <td className="num">{kurs.teilnehmerAnzahl ?? 0}</td>
                    <td>
                      {kurs.archiviert ? (
                        <span className="badge-status archiviert">archiviert</span>
                      ) : (
                        <span className="badge-status">aktiv</span>
                      )}
                    </td>
                    <td>
                      <div className="aktionen">
                        <button
                          type="button"
                          className="btn btn-klein"
                          onClick={() => bearbeitenStarten(kurs)}
                          disabled={aktion}
                        >
                          Bearbeiten
                        </button>
                        <button
                          type="button"
                          className="btn btn-klein"
                          onClick={() => void archivierenUmschalten(kurs)}
                          disabled={aktion}
                        >
                          {kurs.archiviert ? 'Reaktivieren' : 'Archivieren'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-klein btn-gefahr"
                          onClick={() => void loeschen(kurs)}
                          disabled={aktion}
                        >
                          Löschen
                        </button>
                      </div>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default CoursesPage;
