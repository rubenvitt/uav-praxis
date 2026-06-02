import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TaskDetail } from './TaskDetail';
import type { Aufgabe } from '../data/tasks';
import { leererFortschritt } from '../domain/progress';

const aufgabe: Aufgabe = {
  id: '2-8',
  teil: 2,
  nummer: '2.8',
  titel: 'Simulierter Ausfall des GPS',
  schritte: ['Schritt eins'],
  lernziel: 'Lernziel-Text',
  durchfuehrungshinweise: ['Hinweis A'],
  sicherheitshinweise: ['Übung nur in Sichtweite durchführen!'],
  zielanzahlDefault: 4,
};

function setup(over = {}) {
  const handlers = {
    onAdd: vi.fn(),
    onRemove: vi.fn(),
    onZielanzahl: vi.fn(),
    onNichtAnwendbar: vi.fn(),
    onBack: vi.fn(),
  };
  render(
    <TaskDetail
      aufgabe={aufgabe}
      fortschritt={leererFortschritt(4)}
      heute="2026-06-02"
      {...handlers}
      {...over}
    />,
  );
  return handlers;
}

describe('TaskDetail', () => {
  it('zeigt Titel, Schritte, Lernziel und Sicherheitshinweis', () => {
    setup();
    expect(screen.getByText(/Simulierter Ausfall des GPS/)).toBeInTheDocument();
    expect(screen.getByText('Schritt eins')).toBeInTheDocument();
    expect(screen.getByText(/Lernziel-Text/)).toBeInTheDocument();
    expect(screen.getByText(/nur in Sichtweite/)).toBeInTheDocument();
  });

  it('reicht eine neue Durchführung an onAdd weiter', async () => {
    const { onAdd } = setup();
    await userEvent.click(screen.getByRole('button', { name: /hinzufügen/i }));
    expect(onAdd).toHaveBeenCalled();
  });

  it('blendet bei "nicht anwendbar" das Erfassen aus', () => {
    setup({ fortschritt: { ...leererFortschritt(4), nichtAnwendbar: true } });
    expect(screen.queryByRole('button', { name: /hinzufügen/i })).toBeNull();
  });
});
