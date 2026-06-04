import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider } from '@tanstack/react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import type { AuthContextValue } from '../auth/AuthContext';
import { LokalProvider } from '../lokal/LokalContext';
import { createTestRouter } from '../test/router-utils';

const loginMitCode = vi.fn<AuthContextValue['loginMitCode']>().mockResolvedValue(undefined);
let fehler: string | null = null;
let laden = false;

// useAuth wird gestubbt; loginMitCode ist eine Spy-Funktion. AuthProvider wird in
// diesem Test nicht gebraucht (der Router wird ohne AuthProvider gerendert).
vi.mock('../auth/AuthContext', () => ({
  useAuth: (): AuthContextValue => ({
    identity: { kind: 'anon' },
    laden,
    fehler,
    loginMitCode,
    logout: vi.fn(),
    neuLaden: vi.fn(),
  }),
}));

/** Rendert die echte /login-Route (inkl. validateSearch) auf Memory-History. */
function renderMit(pfad: string) {
  const { router, queryClient } = createTestRouter(pfad);
  const ergebnis = render(
    <QueryClientProvider client={queryClient}>
      <LokalProvider>
        <RouterProvider router={router} />
      </LokalProvider>
    </QueryClientProvider>,
  );
  return { ...ergebnis, router };
}

describe('LoginPage', () => {
  beforeEach(() => {
    loginMitCode.mockClear();
    fehler = null;
    laden = false;
  });

  it('liest den Code aus dem Magic-Link und ruft loginMitCode auf', async () => {
    const { router } = renderMit('/login?code=TEST123');
    await waitFor(() => expect(loginMitCode).toHaveBeenCalledWith('TEST123'));
    // useRef-Wächter: der Magic-Link löst genau einen Login aus (kein Doppel-Fire).
    expect(loginMitCode).toHaveBeenCalledTimes(1);
    // Der Code wird per navigate({ search: {} }) aus der URL entfernt.
    await waitFor(() =>
      expect((router.state.location.search as { code?: string }).code).toBeUndefined(),
    );
  });

  it('normalisiert einen Magic-Link-Code auf Großschreibung', async () => {
    renderMit('/login?code=abcd-1234');
    await waitFor(() => expect(loginMitCode).toHaveBeenCalledWith('ABCD-1234'));
  });

  it('ruft loginMitCode bei manueller Eingabe (großgeschrieben) auf', async () => {
    renderMit('/login');
    await userEvent.type(await screen.findByLabelText(/Persönlicher Code/i), 'mein-code');
    await userEvent.click(screen.getByRole('button', { name: /Anmelden/i }));
    expect(loginMitCode).toHaveBeenCalledWith('MEIN-CODE');
  });

  it('löst ohne Magic-Link-Code keinen Login aus', async () => {
    renderMit('/login');
    await screen.findByLabelText(/Persönlicher Code/i);
    expect(loginMitCode).not.toHaveBeenCalled();
  });

  it('behandelt einen leeren ?code= nicht als Login', async () => {
    renderMit('/login?code=');
    await screen.findByLabelText(/Persönlicher Code/i);
    expect(loginMitCode).not.toHaveBeenCalled();
  });

  it('fängt ein ungültiges (mehrfaches) ?code-Format ab und löst keinen Login aus', async () => {
    // Doppeltes `code` → Array → z.string() schlägt fehl → .catch(undefined) → kein Login.
    renderMit('/login?code=a&code=b');
    await screen.findByLabelText(/Persönlicher Code/i);
    expect(loginMitCode).not.toHaveBeenCalled();
  });

  it('zeigt die Fehlermeldung aus dem AuthContext an', async () => {
    fehler = 'Ungültiger Code';
    renderMit('/login');
    expect(await screen.findByRole('alert')).toHaveTextContent('Ungültiger Code');
  });
});
