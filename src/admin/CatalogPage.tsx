import { useCallback, useEffect, useState } from 'react';
import type { TaskDTO, Teil } from '../../shared/types';
import { api, ApiError, type TaskEingabe } from '../api/client';

interface FormZustand {
  teil: Teil;
  nummer: string;
  titel: string;
  lernziel: string;
  schritte: string[];
  durchfuehrungshinweise: string[];
  sicherheitshinweise: string[];
  zielanzahlDefault: number;
  aktiv: boolean;
}

const LEER: FormZustand = {
  teil: 1,
  nummer: '',
  titel: '',
  lernziel: '',
  schritte: [],
  durchfuehrungshinweise: [],
  sicherheitshinweise: [],
  zielanzahlDefault: 1,
  aktiv: true,
};

function formAusTask(t: TaskDTO): FormZustand {
  return {
    teil: t.teil,
    nummer: t.nummer,
    titel: t.titel,
    lernziel: t.lernziel,
    schritte: [...t.schritte],
    durchfuehrungshinweise: [...t.durchfuehrungshinweise],
    sicherheitshinweise: [...t.sicherheitshinweise],
    zielanzahlDefault: t.zielanzahlDefault,
    aktiv: t.aktiv,
  };
}

function eingabeAus(z: FormZustand): TaskEingabe {
  return {
    teil: z.teil,
    nummer: z.nummer.trim(),
    titel: z.titel.trim(),
    lernziel: z.lernziel.trim(),
    schritte: z.schritte.map((s) => s.trim()).filter(Boolean),
    durchfuehrungshinweise: z.durchfuehrungshinweise.map((s) => s.trim()).filter(Boolean),
    sicherheitshinweise: z.sicherheitshinweise.map((s) => s.trim()).filter(Boolean),
    zielanzahlDefault: z.zielanzahlDefault,
    aktiv: z.aktiv,
  };
}

/** Editor für eine string[]-Liste (Schritte / Hinweise): pro Eintrag ein Feld
 * mit Entfernen, plus „Hinzufügen". */
function ListenEditor({
  titel,
  werte,
  onChange,
}: {
  titel: string;
  werte: string[];
  onChange: (neu: string[]) => void;
}) {
  return (
    <div className="feld">
      <span className="feld-label">{titel}</span>
      <div className="listen-editor">
        {werte.map((wert, i) => (
          <div className="zeile" key={i}>
            <input
              className="eingabe"
              type="text"
              value={wert}
              onChange={(e) => {
                const kopie = [...werte];
                kopie[i] = e.target.value;
                onChange(kopie);
              }}
            />
            <button
              type="button"
              className="btn btn-klein btn-gefahr"
              onClick={() => onChange(werte.filter((_, j) => j !== i))}
              aria-label={`${titel} Eintrag ${i + 1} entfernen`}
            >
              Entfernen
            </button>
          </div>
        ))}
        <button type="button" className="btn btn-klein" onClick={() => onChange([...werte, ''])}>
          Eintrag hinzufügen
        </button>
      </div>
    </div>
  );
}

function TaskFormular({
  zustand,
  setZustand,
  onSpeichern,
  onAbbrechen,
  aktion,
  titel,
}: {
  zustand: FormZustand;
  setZustand: (z: FormZustand) => void;
  onSpeichern: (e: React.FormEvent) => void;
  onAbbrechen: () => void;
  aktion: boolean;
  titel: string;
}) {
  return (
    <form className="karte" onSubmit={onSpeichern}>
      <h3>{titel}</h3>
      <div className="feld-reihe">
        <div className="feld">
          <label htmlFor="task-teil">Teil</label>
          <select
            id="task-teil"
            className="eingabe"
            value={zustand.teil}
            onChange={(e) => setZustand({ ...zustand, teil: Number(e.target.value) as Teil })}
          >
            <option value={1}>Teil 1</option>
            <option value={2}>Teil 2</option>
            <option value={3}>Teil 3</option>
          </select>
        </div>
        <div className="feld">
          <label htmlFor="task-nummer">Nummer</label>
          <input
            id="task-nummer"
            type="text"
            value={zustand.nummer}
            onChange={(e) => setZustand({ ...zustand, nummer: e.target.value })}
            placeholder="z. B. 1.1"
            required
          />
        </div>
        <div className="feld">
          <label htmlFor="task-ziel">Zielanzahl</label>
          <input
            id="task-ziel"
            type="number"
            min={1}
            value={zustand.zielanzahlDefault}
            onChange={(e) =>
              setZustand({ ...zustand, zielanzahlDefault: Math.max(1, Number(e.target.value) || 1) })
            }
          />
        </div>
      </div>
      <div className="feld">
        <label htmlFor="task-titel">Titel</label>
        <input
          id="task-titel"
          type="text"
          value={zustand.titel}
          onChange={(e) => setZustand({ ...zustand, titel: e.target.value })}
          required
        />
      </div>
      <div className="feld">
        <label htmlFor="task-lernziel">Lernziel</label>
        <textarea
          id="task-lernziel"
          value={zustand.lernziel}
          onChange={(e) => setZustand({ ...zustand, lernziel: e.target.value })}
        />
      </div>
      <ListenEditor
        titel="Schritte"
        werte={zustand.schritte}
        onChange={(neu) => setZustand({ ...zustand, schritte: neu })}
      />
      <ListenEditor
        titel="Durchführungshinweise"
        werte={zustand.durchfuehrungshinweise}
        onChange={(neu) => setZustand({ ...zustand, durchfuehrungshinweise: neu })}
      />
      <ListenEditor
        titel="Sicherheitshinweise"
        werte={zustand.sicherheitshinweise}
        onChange={(neu) => setZustand({ ...zustand, sicherheitshinweise: neu })}
      />
      <label className="check-zeile">
        <input
          type="checkbox"
          checked={zustand.aktiv}
          onChange={(e) => setZustand({ ...zustand, aktiv: e.target.checked })}
        />
        aktiv (im Teilnehmer-Katalog sichtbar)
      </label>
      <div className="formular-aktionen">
        <button
          type="submit"
          className="btn btn-primaer"
          disabled={aktion || !zustand.nummer.trim() || !zustand.titel.trim()}
        >
          Speichern
        </button>
        <button type="button" className="btn" onClick={onAbbrechen}>
          Abbrechen
        </button>
      </div>
    </form>
  );
}

/** Aufgabenkatalog: Voll-CRUD und Reihenfolge (auf/ab). */
export function CatalogPage() {
  const [tasks, setTasks] = useState<TaskDTO[]>([]);
  const [laden, setLaden] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  const [aktion, setAktion] = useState(false);

  const [neuOffen, setNeuOffen] = useState(false);
  const [neu, setNeu] = useState<FormZustand>(LEER);
  const [bearbeiteId, setBearbeiteId] = useState<string | null>(null);
  const [bearbeite, setBearbeite] = useState<FormZustand>(LEER);

  const ladeTasks = useCallback(async () => {
    try {
      setTasks(await api.adminGetTasks());
      setFehler(null);
    } catch (e) {
      setFehler(e instanceof ApiError ? e.message : 'Aufgaben konnten nicht geladen werden.');
    } finally {
      setLaden(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await ladeTasks();
    })();
  }, [ladeTasks]);

  const anlegen = async (e: React.FormEvent) => {
    e.preventDefault();
    setAktion(true);
    setFehler(null);
    try {
      await api.adminCreateTask(eingabeAus(neu));
      setNeu(LEER);
      setNeuOffen(false);
      await ladeTasks();
    } catch (err) {
      setFehler(err instanceof ApiError ? err.message : 'Aufgabe konnte nicht angelegt werden.');
    } finally {
      setAktion(false);
    }
  };

  const speichern = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bearbeiteId) return;
    setAktion(true);
    setFehler(null);
    try {
      await api.adminUpdateTask(bearbeiteId, eingabeAus(bearbeite));
      setBearbeiteId(null);
      await ladeTasks();
    } catch (err) {
      setFehler(err instanceof ApiError ? err.message : 'Aufgabe konnte nicht gespeichert werden.');
    } finally {
      setAktion(false);
    }
  };

  const loeschen = async (t: TaskDTO) => {
    if (!window.confirm(`Aufgabe „${t.nummer} ${t.titel}“ wirklich löschen?`)) return;
    setAktion(true);
    setFehler(null);
    try {
      await api.adminDeleteTask(t.id);
      await ladeTasks();
    } catch (err) {
      setFehler(err instanceof ApiError ? err.message : 'Aufgabe konnte nicht gelöscht werden.');
    } finally {
      setAktion(false);
    }
  };

  const verschieben = async (index: number, richtung: -1 | 1) => {
    const ziel = index + richtung;
    if (ziel < 0 || ziel >= tasks.length) return;
    const neueReihe = [...tasks];
    const [bewegt] = neueReihe.splice(index, 1);
    neueReihe.splice(ziel, 0, bewegt);
    setTasks(neueReihe); // optimistisch
    setAktion(true);
    setFehler(null);
    try {
      await api.adminReorderTasks(neueReihe.map((t) => t.id));
      await ladeTasks();
    } catch (err) {
      setFehler(err instanceof ApiError ? err.message : 'Reihenfolge konnte nicht gespeichert werden.');
      await ladeTasks();
    } finally {
      setAktion(false);
    }
  };

  return (
    <div>
      <div className="admin-sektion-kopf">
        <h2>Aufgabenkatalog</h2>
        <button type="button" className="btn btn-primaer" onClick={() => setNeuOffen((v) => !v)}>
          {neuOffen ? 'Abbrechen' : 'Aufgabe anlegen'}
        </button>
      </div>

      {fehler && (
        <p className="admin-fehler" role="alert">
          {fehler}
        </p>
      )}

      {neuOffen && (
        <TaskFormular
          zustand={neu}
          setZustand={setNeu}
          onSpeichern={anlegen}
          onAbbrechen={() => {
            setNeuOffen(false);
            setNeu(LEER);
          }}
          aktion={aktion}
          titel="Neue Aufgabe"
        />
      )}

      {laden ? (
        <p className="admin-hinweis">Wird geladen …</p>
      ) : tasks.length === 0 ? (
        <p className="admin-leer">Noch keine Aufgaben im Katalog.</p>
      ) : (
        <div className="tabelle-umbruch">
          <table className="tabelle">
            <thead>
              <tr>
                <th>Nr.</th>
                <th>Titel</th>
                <th>Teil</th>
                <th>Ziel</th>
                <th>Status</th>
                <th aria-label="Reihenfolge" />
                <th aria-label="Aktionen" />
              </tr>
            </thead>
            <tbody>
              {tasks.map((t, i) =>
                bearbeiteId === t.id ? (
                  <tr key={t.id}>
                    <td colSpan={7}>
                      <TaskFormular
                        zustand={bearbeite}
                        setZustand={setBearbeite}
                        onSpeichern={speichern}
                        onAbbrechen={() => setBearbeiteId(null)}
                        aktion={aktion}
                        titel={`Aufgabe ${t.nummer} bearbeiten`}
                      />
                    </td>
                  </tr>
                ) : (
                  <tr key={t.id} className={t.aktiv ? undefined : 'zeile-inaktiv'}>
                    <td>{t.nummer}</td>
                    <td>{t.titel}</td>
                    <td>{t.teil}</td>
                    <td className="num">{t.zielanzahlDefault}</td>
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
                          onClick={() => void verschieben(i, -1)}
                          disabled={aktion || i === 0}
                          aria-label={`${t.nummer} nach oben`}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="btn btn-klein"
                          onClick={() => void verschieben(i, 1)}
                          disabled={aktion || i === tasks.length - 1}
                          aria-label={`${t.nummer} nach unten`}
                        >
                          ↓
                        </button>
                      </div>
                    </td>
                    <td>
                      <div className="aktionen">
                        <button
                          type="button"
                          className="btn btn-klein"
                          onClick={() => {
                            setBearbeiteId(t.id);
                            setBearbeite(formAusTask(t));
                          }}
                          disabled={aktion}
                        >
                          Bearbeiten
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
                ),
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default CatalogPage;
