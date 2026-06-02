import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dashboard } from './Dashboard';
import { AUFGABEN } from '../data/tasks';
import { leererFortschritt } from '../domain/progress';

function vollerFortschritt() {
  const f: Record<string, ReturnType<typeof leererFortschritt>> = {};
  for (const a of AUFGABEN) f[a.id] = leererFortschritt(a.zielanzahlDefault);
  return f;
}

describe('Dashboard', () => {
  it('zeigt den Gesamtfortschritt 0 / 24', () => {
    render(<Dashboard fortschritt={vollerFortschritt()} onSelect={vi.fn()} />);
    expect(screen.getByText(/0 \/ 24/)).toBeInTheDocument();
  });

  it('listet alle 24 Aufgaben', () => {
    render(<Dashboard fortschritt={vollerFortschritt()} onSelect={vi.fn()} />);
    expect(screen.getByText(/1\.1/)).toBeInTheDocument();
    expect(screen.getByText(/3\.5/)).toBeInTheDocument();
  });

  it('ruft onSelect mit der Aufgaben-ID auf', async () => {
    const onSelect = vi.fn();
    render(<Dashboard fortschritt={vollerFortschritt()} onSelect={onSelect} />);
    await userEvent.click(screen.getByText(/Schwebeflug/));
    expect(onSelect).toHaveBeenCalledWith('1-1');
  });
});
