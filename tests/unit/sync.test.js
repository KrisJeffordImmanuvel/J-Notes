import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { installFakeGoogle } from './fake-google.js';

globalThis.document = { querySelectorAll: () => [], addEventListener: () => { } };
globalThis.location = { protocol: 'https:' };

/** A separate "device": its own module instances and its own browser database. */
async function device() {
  vi.resetModules();
  globalThis.indexedDB = new IDBFactory();
  const storage = await import('../../src/lib/storage.js');
  await storage.initStore();
  const state = await import('../../src/data/state.js');
  const sync = await import('../../src/data/sync.js');
  const vault = await import('../../src/data/vault.js');
  const formats = await import('../../src/data/formats.js');
  state.setS(state.migrate(state.defaultData()));
  state.setVault({ enc: false });
  sync.initSync();
  const d = {
    state, sync, vault, formats,
    get S() { return state.S; },
    note: title => state.S.notes.find(n => n.title === title),
    add(title, body = '') { const n = state.newNote({ title, body }); state.S.notes.push(n); return n; },
    edit(title, body) { const n = d.note(title); n.body = body; n.updated = Date.now() + 1; return n; }
  };
  return d;
}

describe('Google Drive sync', () => {
  let drive;
  beforeEach(() => { drive = installFakeGoogle(); });

  it('signing in on the first device creates the cloud copy', async () => {
    const a = await device();
    a.add('Groceries', 'milk');
    await a.sync.connectGoogle();
    expect(a.sync.sync.state).toBe('idle');
    expect(a.sync.sync.account.email).toBe('kris@example.com');
    expect(drive.files.size).toBe(1);
    const rec = JSON.parse([...drive.files.values()][0].content);
    expect(rec.data.notes.map(n => n.title)).toContain('Groceries');
  });

  it('a fresh second device takes the cloud copy, and edits flow both ways', async () => {
    const a = await device();
    a.add('Groceries', 'milk');
    a.S.notes.find(n => n.id === 'welcome').body += '\nedited on A';
    a.S.notes.find(n => n.id === 'welcome').updated = Date.now() + 5;
    await a.sync.connectGoogle();

    const b = await device();
    await b.sync.connectGoogle();
    expect(b.note('Groceries').body).toBe('milk');
    expect(b.S.notes.filter(n => n.title === 'Welcome to J Notes')).toHaveLength(1);
    expect(b.S.notebooks).toHaveLength(3);

    b.edit('Groceries', 'milk, eggs');
    await b.sync.syncNow();

    // device A picks it up, with nothing to send back
    const uploads = drive.uploads;
    await a.sync.syncNow();
    expect(a.note('Groceries').body).toBe('milk, eggs');
    expect(drive.uploads).toBe(uploads);
  });

  it('does not upload when nothing changed', async () => {
    const a = await device();
    await a.sync.connectGoogle();
    const n = drive.uploads;
    await a.sync.syncNow();
    await a.sync.syncNow();
    expect(drive.uploads).toBe(n);
  });

  it('keeps edits to different notes made on both devices at once', async () => {
    const a = await device();
    a.add('One', '1'); a.add('Two', '2');
    await a.sync.connectGoogle();
    const b = await device();
    await b.sync.connectGoogle();

    a.edit('One', 'one from A');
    b.edit('Two', 'two from B');
    await b.sync.syncNow();
    await a.sync.syncNow();      // A pulls B's change, merges, uploads its own
    await b.sync.syncNow();
    for (const d of [a, b]) {
      expect(d.note('One').body).toBe('one from A');
      expect(d.note('Two').body).toBe('two from B');
    }
  });

  it('notes deleted forever stay deleted on the other device', async () => {
    const a = await device();
    a.add('Old idea');
    await a.sync.connectGoogle();
    const b = await device();
    await b.sync.connectGoogle();
    expect(b.note('Old idea')).toBeTruthy();

    a.state.forgetNotes([a.note('Old idea')]);
    await a.sync.syncNow();
    await b.sync.syncNow();
    expect(b.note('Old idea')).toBeUndefined();
    await b.sync.syncNow();
    expect(a.note('Old idea')).toBeUndefined();
  });

  it('with the app lock on, the cloud copy is encrypted and another device needs the PIN once', async () => {
    const a = await device();
    a.add('Diary secret', 'the treasure is under the oak');
    await a.sync.connectGoogle();
    await a.vault.enableLock('2468');
    await a.sync.syncNow();
    const stored = [...drive.files.values()][0].content;
    expect(stored).toContain('"enc":true');
    expect(stored).not.toContain('treasure');

    const b = await device();
    await b.sync.connectGoogle();
    expect(b.sync.sync.state).toBe('needs-pin');
    await expect(b.sync.unlockCloudCopy('0000')).rejects.toThrow();
    await b.sync.unlockCloudCopy('2468');
    expect(b.sync.sync.state).toBe('idle');
    expect(b.note('Diary secret').body).toContain('treasure');
    expect(b.state.vault.enc).toBe(true);            // the lock follows the account

    // turning the lock off on B turns it off on A too
    await b.vault.disableLock();
    await b.sync.syncNow();
    await a.sync.syncNow();
    expect(a.state.vault.enc).toBe(false);
  });

  it('a lock set up before lock times were tracked still encrypts the cloud copy', async () => {
    const a = await device();
    a.add('Old secret', 'buried treasure');
    await a.vault.enableLock('1357');
    a.state.vault.lockAt = 0;                       // as loaded from data saved by an older version
    await a.sync.connectGoogle();
    const stored = [...drive.files.values()][0].content;
    expect(stored).toContain('"enc":true');
    expect(stored).not.toContain('treasure');
  });

  it('pauses when the Google session expires and resumes after reconnecting', async () => {
    const a = await device();
    await a.sync.connectGoogle();
    const google = await import('../../src/lib/google.js');   // same instance as `a` (last device created)
    google.forgetToken();
    await a.sync.syncNow();
    expect(a.sync.sync.state).toBe('paused');
    await a.sync.reconnectGoogle();
    expect(a.sync.sync.state).toBe('idle');
  });

  it('signing out keeps local notes', async () => {
    const a = await device();
    a.add('Keep me');
    await a.sync.connectGoogle();
    await a.sync.signOutGoogle();
    expect(a.sync.isSignedIn()).toBe(false);
    expect(a.note('Keep me')).toBeTruthy();
    expect(drive.files.size).toBe(1);
  });
});
