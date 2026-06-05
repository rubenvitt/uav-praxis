import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AnzahlFeld } from './AnzahlFeld';

// Harness, der den echten Eltern-Handler nachbildet: jeder gemeldete Wert
// wird (wie zielanzahlSetzen) auf min. 1 geklemmt und zurück in `value` gespiegelt.
function Harness({ start, onValueChange }: { start: number; onValueChange?: (n: number) => void }) {
  const [wert, setWert] = useState(start);
  return (
    <AnzahlFeld
      value={wert}
      min={1}
      onValueChange={(n) => {
        const geklemmt = Math.max(1, Math.floor(n) || 1);
        setWert(geklemmt);
        onValueChange?.(geklemmt);
      }}
    />
  );
}

describe('AnzahlFeld', () => {
  it('lässt sich leeren und mit neuer Zahl überschreiben (kein Sprung auf min)', async () => {
    const user = userEvent.setup();
    render(<Harness start={1} />);
    const input = screen.getByRole('spinbutton');

    await user.clear(input);
    expect(input).toHaveValue(null); // leer – NICHT sofort zurück auf 1

    await user.type(input, '2');
    expect(input).toHaveValue(2);
  });

  it('meldet beim Leeren keinen Wert nach oben', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Harness start={4} onValueChange={onValueChange} />);

    await user.clear(screen.getByRole('spinbutton'));
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('stellt beim Verlassen eines leeren Felds den letzten gültigen Wert wieder her', async () => {
    const user = userEvent.setup();
    render(<Harness start={4} />);
    const input = screen.getByRole('spinbutton');

    await user.clear(input);
    await user.tab(); // blur
    expect(input).toHaveValue(4);
  });
});
