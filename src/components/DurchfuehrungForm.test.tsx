import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DurchfuehrungForm } from './DurchfuehrungForm';

describe('DurchfuehrungForm', () => {
  it('ruft onAdd mit den Feldwerten auf', async () => {
    const onAdd = vi.fn();
    render(<DurchfuehrungForm onAdd={onAdd} heute="2026-06-02" />);

    await userEvent.type(screen.getByLabelText(/Drohnensteuerer/i), 'Max');
    await userEvent.type(screen.getByLabelText(/Luftraumbeobachter/i), 'Erika');
    await userEvent.click(screen.getByRole('button', { name: /hinzufügen/i }));

    expect(onAdd).toHaveBeenCalledWith({
      datum: '2026-06-02',
      drohnensteuerer: 'Max',
      luftraumbeobachter: 'Erika',
    });
  });

  it('belegt das Datum mit heute vor', () => {
    render(<DurchfuehrungForm onAdd={vi.fn()} heute="2026-06-02" />);
    expect(screen.getByLabelText(/Datum/i)).toHaveValue('2026-06-02');
  });
});
