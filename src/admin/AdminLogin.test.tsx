import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminLogin } from './AdminLogin';

describe('AdminLogin', () => {
  it('zeigt den PocketID-Anmeldebutton und einen Hinweis', () => {
    render(<AdminLogin />);
    expect(screen.getByRole('button', { name: /Mit PocketID anmelden/i })).toBeInTheDocument();
    expect(screen.getByText(/OIDC auf dem Server nicht konfiguriert/i)).toBeInTheDocument();
  });

  it('leitet beim Klick zum Admin-Login-Endpunkt weiter', async () => {
    const assign = vi.fn();
    const original = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...original, assign },
    });

    render(<AdminLogin />);
    await userEvent.click(screen.getByRole('button', { name: /Mit PocketID anmelden/i }));
    expect(assign).toHaveBeenCalledWith('/api/auth/admin/login');

    Object.defineProperty(window, 'location', { configurable: true, value: original });
  });
});
