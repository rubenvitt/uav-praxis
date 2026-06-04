import { useEffect, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useSuspenseQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Teil } from '../../shared/types';
import { api, ApiError, type TeilnehmerPatch } from '../api/client';
import { participantDetailQuery, participantsQuery } from './queries';

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
 * Stammdaten bearbeiten, Code/Link, Detail-CSV-Export. Daten cache-first über
 * `participantDetailQuery` (Loader prefetcht). Mutationen via `useMutation`. */
export function ParticipantDetailPage({ participantId }: { participantId: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: detail } = useSuspenseQuery(participantDetailQuery(participantId));

  const [fehler, setFehler] = useState<string | null>(null);
  const [kopiert, setKopiert] = useState<string | null>(null);

  const [bearbeiten, setBearbeiten] = useState(false);
  const [name, setName] = useState(detail.participant.name);
  const [beginn, setBeginn] = useState(detail.participant.beginn ?? '');
  const [aktiv, setAktiv] = useState(detail.participant.aktiv);

  // Formularfelder mit frischen Server-Daten synchronisieren, wenn die Query neu
  // lädt (z. B. nach „Code neu" oder Invalidate) und gerade nicht bearbeitet wird.
  useEffect(() => {
    if (bearbeiten) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(detail.participant.name);
    setBeginn(detail.participant.beginn ?? '');
    setAktiv(detail.participant.aktiv);
  }, [detail, bearbeiten]);

  const detailInvalidieren = () =>
    queryClient.invalidateQueries({
      queryKey: participantDetailQuery(participantId).queryKey,
    });

  const patchMutation = useMutation({
    mutationFn: (patch: TeilnehmerPatch) => api.adminUpdateParticipant(participantId, patch),
    onSuccess: async () => {
      setFehler(null);
      await Promise.all([
        detailInvalidieren(),
        queryClient.invalidateQueries({ queryKey: participantsQuery.queryKey }),
      ]);
    },
    onError: (err) => {
      setFehler(err instanceof ApiError ? err.message : 'Speichern fehlgeschlagen.');
    },
  });

  const loeschenMutation = useMutation({
    mutationFn: () => api.adminDeleteParticipant(participantId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: participantsQuery.queryKey });
      await navigate({ to: '/admin/participants' });
    },
    onError: (err) => {
      setFehler(err instanceof ApiError ? err.message : 'Löschen fehlgeschlagen.');
    },
  });

  const aktion = patchMutation.isPending || loeschenMutation.isPending;

  const speichern = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setFehler(null);
    patchMutation.mutate(
      { name: name.trim(), beginn: beginn || null, aktiv },
      { onSuccess: () => setBearbeiten(false) },
    );
  };

  const codeNeu = () => {
    if (
      !window.confirm(
        `Für „${detail.participant.name}" einen neuen Login-Code erzeugen? Der alte Code wird ungültig.`,
      )
    ) {
      return;
    }
    setFehler(null);
    patchMutation.mutate({ codeNeu: true });
  };

  const loeschen = () => {
    if (
      !window.confirm(
        `Teilnehmer „${detail.participant.name}" und alle Durchführungen wirklich löschen?`,
      )
    ) {
      return;
    }
    setFehler(null);
    loeschenMutation.mutate();
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
    <div>
      <p className="admin-pfad">
        <Link to="/admin/participants">Teilnehmer</Link> · {detail.participant.name}
      </p>

      {fehler && (
        <p className="admin-fehler" role="alert">
          {fehler}
        </p>
      )}

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
            <button type="button" className="btn" onClick={() => codeNeu()} disabled={aktion}>
              Code neu
            </button>
            <button
              type="button"
              className="btn btn-gefahr"
              onClick={() => loeschen()}
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
    </div>
  );
}

export default ParticipantDetailPage;
