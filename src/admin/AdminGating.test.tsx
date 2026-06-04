import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { RouterProvider } from '@tanstack/react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import type { Identity, ParticipantProgressDTO } from '../../shared/types';
import { LokalProvider } from '../lokal/LokalContext';
import { createTestRouter } from '../test/router-utils';

const me = vi.fn<() => Promise<Identity>>();
const adminGetParticipants = vi.fn<() => Promise<ParticipantProgressDTO[]>>();

vi.mock('../api/client', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client');
  return {
    ...actual,
    api: {
      ...actual.api,
      me: () => me(),
      adminGetParticipants: () => adminGetParticipants(),
    },
  };
});

// syncEngine nicht real triggern.
vi.mock('../offline/syncEngine', () => ({
  syncEngine: { start: vi.fn(() => () => {}), statusLesen: vi.fn(() => 'online'), abonnieren: vi.fn(() => () => {}) },
}));

import { AuthProvider } from '../auth/AuthContext';

function renderAdmin(initial: string) {
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
}

const ADMIN: Identity = { kind: 'admin', id: 'a-1', name: 'Chef', email: null };

beforeEach(() => {
  localStorage.clear();
  me.mockReset();
  adminGetParticipants.mockReset();
});

describe('Admin-Gating + Loader', () => {
  it('zeigt nach Admin-Login die geladene Teilnehmerliste (kein Fehler)', async () => {
    me.mockResolvedValue(ADMIN);
    adminGetParticipants.mockResolvedValue([
      {
        participant: {
          id: 'p-1',
          name: 'Erika Muster',
          loginCode: 'ABCD-1234',
          aktiv: true,
          beginn: null,
          lastSeen: null,
        },
        erledigt: 0,
        gesamt: 10,
        quote: 0,
      },
    ]);
    renderAdmin('/admin/participants');
    expect(await screen.findByText('Erika Muster')).toBeInTheDocument();
    expect(screen.queryByText(/konnten nicht geladen werden|nicht geladen werden/)).toBeNull();
  });

  it('zeigt bei fehlender Admin-Identität die Anmeldung statt eines Fehlers', async () => {
    me.mockResolvedValue({ kind: 'anon' });
    adminGetParticipants.mockRejectedValue(new Error('401'));
    renderAdmin('/admin/participants');
    // Layout rendert AdminLogin (nicht <Outlet/>), der Loader-401 bleibt folgenlos.
    expect(await screen.findByRole('button', { name: /Mit PocketID anmelden/i })).toBeInTheDocument();
    // Loader feuerte wirklich (URL-getriebener Match), ...
    await waitFor(() => expect(adminGetParticipants).toHaveBeenCalled());
    // ... aber der Loader-Fehler blieb schlummernd: keine Fehler-UI (AdminFehler) sichtbar.
    expect(screen.queryByText(/nicht geladen werden/)).toBeNull();
    await waitFor(() => expect(me).toHaveBeenCalled());
  });
});
