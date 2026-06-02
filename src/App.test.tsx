import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

beforeEach(() => localStorage.clear());

describe('App', () => {
  it('startet in der Übersicht', () => {
    render(<App />);
    expect(screen.getByText(/Drohnen-Trainingsbegleiter/)).toBeInTheDocument();
  });

  it('navigiert in die Detailansicht und zurück', async () => {
    render(<App />);
    await userEvent.click(screen.getByText(/Schwebeflug/));
    expect(screen.getByText(/Aufgabe 1\.1/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Übersicht/ }));
    expect(screen.getByText(/erledigt/)).toBeInTheDocument();
  });

  it('eine erfasste Durchführung erhöht den Zähler nach Rückkehr', async () => {
    render(<App />);
    await userEvent.click(screen.getByText(/Schwebeflug/));
    await userEvent.click(screen.getByRole('button', { name: /hinzufügen/i }));
    await userEvent.click(screen.getByRole('button', { name: /Übersicht/ }));
    await userEvent.click(screen.getByText(/Schwebeflug/));
    expect(screen.getByText(/1 \/ 4/)).toBeInTheDocument();
  });
});
