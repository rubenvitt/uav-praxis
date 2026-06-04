import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

beforeEach(() => localStorage.clear());

/** Startseite rendern und in den anonymen lokalen Übungsmodus (Dashboard) wechseln. */
async function lokalesDashboardOeffnen() {
  render(<App />);
  await userEvent.click(await screen.findByRole('button', { name: /Ohne Anmeldung/ }));
}

describe('App', () => {
  it('zeigt auf der Startseite die Zugangsauswahl', async () => {
    render(<App />);
    expect(await screen.findByRole('button', { name: /Teilnehmer/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Verwaltung/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ohne Anmeldung/ })).toBeInTheDocument();
  });

  it('navigiert in die Detailansicht und zurück', async () => {
    await lokalesDashboardOeffnen();
    await userEvent.click(screen.getByText(/Schwebeflug/));
    expect(screen.getByText(/Aufgabe 1\.1/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Übersicht/ }));
    expect(screen.getByText(/Gesamtfortschritt/)).toBeInTheDocument();
  });

  it('spiegelt die geöffnete Aufgabe in der URL und kehrt per Browser-Zurück zurück', async () => {
    await lokalesDashboardOeffnen();
    await userEvent.click(screen.getByText(/Schwebeflug/));
    expect(window.location.pathname).toMatch(/^\/aufgabe\//);
    window.history.back();
    expect(await screen.findByText(/Gesamtfortschritt/)).toBeInTheDocument();
    expect(window.location.pathname).toBe('/');
  });

  it('eine erfasste Durchführung erhöht den Zähler nach Rückkehr', async () => {
    await lokalesDashboardOeffnen();
    await userEvent.click(screen.getByText(/Schwebeflug/));
    await userEvent.click(screen.getByRole('button', { name: /hinzufügen/i }));
    await userEvent.click(screen.getByRole('button', { name: /Übersicht/ }));
    await userEvent.click(screen.getByText(/Schwebeflug/));
    expect(screen.getByText(/1 \/ 4/)).toBeInTheDocument();
  });
});
