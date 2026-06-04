import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, type AnyRouter } from '@tanstack/react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './auth/AuthContext';
import { LokalProvider } from './lokal/LokalContext';
import { createTestRouter } from './test/router-utils';

beforeEach(() => localStorage.clear());

/**
 * Rendert die App-Komposition (echte Provider) auf einem Memory-History-Router.
 * `api.me()` wird nicht gemockt → schlägt mangels Server fehl → Identität `anon`,
 * useKatalog fällt auf den lokalen Fallback-Katalog zurück.
 */
function renderApp(initial = '/'): AnyRouter {
  const { router, queryClient } = createTestRouter(initial);
  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LokalProvider>
          <RouterProvider router={router} />
        </LokalProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );
  return router;
}

/** App rendern und in den anonymen lokalen Übungsmodus (Dashboard) wechseln. */
async function lokalesDashboardOeffnen(): Promise<AnyRouter> {
  const router = renderApp('/');
  await userEvent.click(await screen.findByRole('button', { name: /Ohne Anmeldung/ }));
  return router;
}

describe('App', () => {
  it('zeigt auf der Startseite die Zugangsauswahl', async () => {
    renderApp('/');
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

  it('spiegelt die geöffnete Aufgabe in der URL und kehrt per Zurück zurück', async () => {
    const router = await lokalesDashboardOeffnen();
    await userEvent.click(screen.getByText(/Schwebeflug/));
    expect(router.state.location.pathname).toMatch(/^\/aufgabe\//);
    await act(async () => {
      router.history.back();
    });
    expect(await screen.findByText(/Gesamtfortschritt/)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
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
