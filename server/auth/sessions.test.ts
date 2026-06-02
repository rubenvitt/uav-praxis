import '../test/_env.ts';
import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { closeDb, getDb } from '../db/client.ts';
import { repo } from '../db/repo.ts';
import { sessionErzeugen, sessionLoeschen, sessionValidieren } from './sessions.ts';

beforeEach(() => {
  closeDb();
  getDb();
});

describe('Session-Token-Hashing (Defense-in-depth)', () => {
  it('speichert nur den SHA-256-Hash in der DB, nicht das Roh-Token', () => {
    const adminId = repo.adminUpserten('sub-h', 'admin@example.org', 'Admin');
    const token = sessionErzeugen('admin', adminId);

    const rows = getDb().prepare('SELECT token FROM sessions').all() as { token: string }[];
    expect(rows).toHaveLength(1);
    // Roh-Token taucht nirgends auf; gespeichert ist dessen Hash.
    expect(rows[0].token).not.toBe(token);
    expect(rows[0].token).toBe(createHash('sha256').update(token).digest('hex'));
  });

  it('validiert das Roh-Token per Hash-Lookup', () => {
    const adminId = repo.adminUpserten('sub-v', 'admin@example.org', 'Admin');
    const token = sessionErzeugen('admin', adminId);

    const identity = sessionValidieren(token);
    expect(identity?.kind).toBe('admin');
    expect(sessionValidieren('falsches-token')).toBeNull();
  });

  it('löscht die Session über das Roh-Token (Logout)', () => {
    const adminId = repo.adminUpserten('sub-l', 'admin@example.org', 'Admin');
    const token = sessionErzeugen('admin', adminId);
    expect(sessionValidieren(token)).not.toBeNull();

    sessionLoeschen(token);
    expect(sessionValidieren(token)).toBeNull();
    expect(getDb().prepare('SELECT token FROM sessions').all()).toHaveLength(0);
  });
});
