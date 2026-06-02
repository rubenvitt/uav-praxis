import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { AuthContextValue } from '../auth/AuthContext';
import { LoginPage } from './LoginPage';

const loginMitCode = vi.fn<AuthContextValue['loginMitCode']>().mockResolvedValue(undefined);
let fehler: string | null = null;
let laden = false;

// useAuth wird durch einen Stub ersetzt; loginMitCode ist eine Spy-Funktion.
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

function renderMit(pfad: string) {
  return render(
    <MemoryRouter initialEntries={[pfad]}>
      <LoginPage />
    </MemoryRouter>,
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    loginMitCode.mockClear();
    fehler = null;
    laden = false;
  });

  it('liest den Code aus dem Magic-Link und ruft loginMitCode auf', async () => {
    renderMit('/login?code=TEST123');
    await waitFor(() => expect(loginMitCode).toHaveBeenCalledWith('TEST123'));
  });

  it('normalisiert einen Magic-Link-Code auf Großschreibung', async () => {
    renderMit('/login?code=abcd-1234');
    await waitFor(() => expect(loginMitCode).toHaveBeenCalledWith('ABCD-1234'));
  });

  it('ruft loginMitCode bei manueller Eingabe (großgeschrieben) auf', async () => {
    renderMit('/login');
    await userEvent.type(screen.getByLabelText(/Persönlicher Code/i), 'mein-code');
    await userEvent.click(screen.getByRole('button', { name: /Anmelden/i }));
    expect(loginMitCode).toHaveBeenCalledWith('MEIN-CODE');
  });

  it('löst ohne Magic-Link-Code keinen Login aus', () => {
    renderMit('/login');
    expect(loginMitCode).not.toHaveBeenCalled();
  });

  it('zeigt die Fehlermeldung aus dem AuthContext an', () => {
    fehler = 'Ungültiger Code';
    renderMit('/login');
    expect(screen.getByRole('alert')).toHaveTextContent('Ungültiger Code');
  });
});
