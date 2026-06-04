import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useSuspenseQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../api/client';
import { participantsQuery } from './queries';

function magicLink(loginCode: string): string {
  return `${window.location.origin}/login?code=${encodeURIComponent(loginCode)}`;
}

function formatDatum(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('de-DE');
}

interface NeuZustand {
  name: string;
  beginn: string;
}

const LEER: NeuZustand = { name: '', beginn: '' };

/**
 * Teilnehmer-Übersicht: flache Liste aller Teilnehmer mit Quote, letzter
 * Aktivität und Code/Link zum Kopieren. Daten cache-first über `participantsQuery`
 * (Loader prefetcht → kein Spinner). Anlegen via `useMutation` + invalidate.
 */
export function ParticipantsPage() {
  const queryClient = useQueryClient();
  const { data: zeilen } = useSuspenseQuery(participantsQuery);

  const [neu, setNeu] = useState<NeuZustand>(LEER);
  const [neuOffen, setNeuOffen] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [kopiert, setKopiert] = useState<string | null>(null);

  const anlegenMutation = useMutation({
    mutationFn: (eingabe: { name: string; beginn: string | null }) =>
      api.adminCreateParticipant(eingabe),
    onSuccess: async () => {
      setNeu(LEER);
      setNeuOffen(false);
      setFehler(null);
      await queryClient.invalidateQueries({ queryKey: participantsQuery.queryKey });
    },
    onError: (err) => {
      setFehler(err instanceof ApiError ? err.message : 'Teilnehmer konnte nicht angelegt werden.');
    },
  });

  const anlegen = (e: React.FormEvent) => {
    e.preventDefault();
    if (!neu.name.trim()) return;
    setFehler(null);
    anlegenMutation.mutate({ name: neu.name.trim(), beginn: neu.beginn || null });
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

  const aktion = anlegenMutation.isPending;

  return (
    <div>
      <div className="admin-sektion-kopf">
        <h2>Teilnehmer</h2>
        <div className="aktionen">
          {zeilen.length > 0 && (
            <a className="btn" href={api.exportUebersichtUrl()} download>
              CSV-Überblick
            </a>
          )}
          <button type="button" className="btn btn-primaer" onClick={() => setNeuOffen((v) => !v)}>
            {neuOffen ? 'Abbrechen' : 'Teilnehmer anlegen'}
          </button>
        </div>
      </div>

      {fehler && (
        <p className="admin-fehler" role="alert">
          {fehler}
        </p>
      )}

      {neuOffen && (
        <form className="karte" onSubmit={anlegen}>
          <h3>Neuer Teilnehmer</h3>
          <div className="feld-reihe" style={{ alignItems: 'flex-end' }}>
            <div className="feld" style={{ flex: '1 1 200px' }}>
              <label htmlFor="tn-name">Name</label>
              <input
                id="tn-name"
                type="text"
                value={neu.name}
                onChange={(e) => setNeu({ ...neu, name: e.target.value })}
                placeholder="Name des Teilnehmers"
                required
              />
            </div>
            <div className="feld">
              <label htmlFor="tn-beginn">Beginn (optional)</label>
              <input
                id="tn-beginn"
                type="date"
                value={neu.beginn}
                onChange={(e) => setNeu({ ...neu, beginn: e.target.value })}
              />
            </div>
            <button type="submit" className="btn btn-primaer" disabled={aktion || !neu.name.trim()}>
              Anlegen
            </button>
          </div>
        </form>
      )}

      {zeilen.length === 0 ? (
        <p className="admin-leer">Noch keine Teilnehmer angelegt.</p>
      ) : (
        <div className="tabelle-umbruch">
          <table className="tabelle">
            <thead>
              <tr>
                <th>Name</th>
                <th>Login-Code</th>
                <th>Magic-Link</th>
                <th>Fortschritt</th>
                <th>Letzte Aktivität</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {zeilen.map(({ participant: t, erledigt, gesamt, quote }) => {
                const prozent = Math.round(quote * 100);
                const link = magicLink(t.loginCode);
                return (
                  <tr key={t.id} className={t.aktiv ? undefined : 'zeile-inaktiv'}>
                    <td>
                      <Link to="/admin/participants/$participantId" params={{ participantId: t.id }}>
                        {t.name}
                      </Link>
                    </td>
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
                          <div className="quote-fuell" style={{ width: `${prozent}%` }} />
                        </div>
                        <span className="quote-zahl">
                          {erledigt}/{gesamt} · {prozent}%
                        </span>
                      </div>
                    </td>
                    <td>{formatDatum(t.lastSeen)}</td>
                    <td>
                      <span className={`badge-status${t.aktiv ? '' : ' inaktiv'}`}>
                        {t.aktiv ? 'aktiv' : 'inaktiv'}
                      </span>
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

export default ParticipantsPage;
