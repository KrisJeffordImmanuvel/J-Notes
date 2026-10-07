/* Sync across devices through the user's own Google Drive (hidden app folder).
 *
 * The cloud holds one file in the same format as local storage (encrypted when the app
 * lock is on). Each pass: pull the file if it changed since we last saw it, merge it into
 * local data (newest version of each note wins, deletions are remembered), then push if
 * the merged result differs from what the cloud has. Local data is never discarded, so
 * devices converge even if two of them save at the same moment.
 *
 * The app lock is account-wide: the most recent lock change (enable, disable, new PIN)
 * on any device wins. A device that can't open the cloud copy asks once for the PIN used
 * on the other device. */
import { dec, debounce } from '../lib/util.js';
import { aesDec, normWords } from '../lib/crypto.js';
import { store } from '../lib/storage.js';
import {
  googleAvailable, validToken, forgetToken, requestToken, revokeAccess, getProfile, AuthError,
  listSyncFiles, getFileMeta, downloadFile, uploadFile, deleteFile
} from '../lib/google.js';
import { S, vault, setVault, privKeys, migrate, stripPrivate } from './state.js';
import { persist, buildRecord, onSaved } from './persist.js';
import { openRecord } from './vault.js';
import { syncMerge, isPristine, syncFingerprint, dedupeStarter } from './formats.js';

export const SYNCKEY = 'jnotes:sync';

/** Public status for the UI. state: off | idle | syncing | paused | needs-pin | offline | error */
export const sync = { state: 'off', message: '', account: null, lastSync: 0 };

let meta = null;          // persisted: { account, fileId, version, fingerprint, lockAt, lastSync, firstSync }
let remoteVault = null;   // key for a cloud copy locked with another device's PIN (this session only)
let pendingRec = null;    // the cloud record waiting for that PIN
let merging = false;
let forcePush = false;     // the cloud copy is readable but this device's lock says it should be encrypted
const hooks = { onChange: () => { }, onRemoteData: () => { }, notify: () => { } };

/** UI callbacks: onChange() on any status change, onRemoteData(changedIds) after a merge, notify(text). */
export function setSyncHooks(h) { Object.assign(hooks, h); }

function setState(state, message = '') {
  sync.state = state; sync.message = message;
  sync.account = meta && meta.account; sync.lastSync = meta ? meta.lastSync || 0 : 0;
  hooks.onChange();
}
async function saveMeta() { if (meta) await store.set(SYNCKEY, JSON.stringify(meta)); else await store.del(SYNCKEY); }

export const isSignedIn = () => !!(meta && meta.account);

/** Call once at start-up, after storage is open. */
export function initSync() {
  try { meta = JSON.parse(store.get(SYNCKEY) || 'null'); } catch (e) { meta = null; }
  if (!googleAvailable() || !isSignedIn()) { setState('off'); return; }
  setState(validToken() ? 'idle' : 'paused');
}

/* ---------- account ---------- */

/** "Continue with Google": sign in (or sign up — the first sync creates the cloud copy). */
export async function connectGoogle() {
  await requestToken({ prompt: 'select_account' });
  const profile = await getProfile();
  if (vault.enc && !vault.lockAt) vault.lockAt = Date.now();   // data from before lock times were tracked
  const same = meta && meta.account && meta.account.sub === profile.sub;
  meta = same ? { ...meta, account: profile } : { account: profile, fileId: null, version: null, fingerprint: null, lockAt: 0, lastSync: 0, firstSync: true };
  await saveMeta();
  setState('syncing');
  await syncNow();
}

/** Get a fresh token after the hourly expiry (one click; usually no account chooser). */
export async function reconnectGoogle() {
  await requestToken({ hint: meta && meta.account && meta.account.email, prompt: '' });
  await syncNow();
}

/** Stop syncing on this device. Notes stay here; the cloud copy stays in Drive. */
export async function signOutGoogle() {
  revokeAccess();
  meta = null; remoteVault = null; pendingRec = null;
  await saveMeta();
  setState('off');
}

/** Remove J Notes' file(s) from the user's Drive, then sign out. */
export async function deleteCloudCopy() {
  for (const f of await listSyncFiles()) await deleteFile(f.id);
  await signOutGoogle();
}

/** Unlock a cloud copy that was encrypted on another device, with that device's PIN or recovery words. */
export async function unlockCloudCopy(secret) {
  if (!pendingRec) return;
  const words = secret.trim().split(/[\s,]+/).length >= 12 ? normWords(secret) : null;   // recovery key
  const { raw, key } = words ? await openRecord(pendingRec, words, true) : await openRecord(pendingRec, secret);
  remoteVault = { raw, key, meta: { pin: pendingRec.pin, rec: pendingRec.rec } };
  pendingRec = null;
  await syncNow();
}

/* ---------- scheduling ---------- */
let running = null, again = false;

/** Run a sync pass now (or right after the one in progress). */
export function syncNow() {
  if (!isSignedIn() || !S) return Promise.resolve();
  if (running) { again = true; return running; }
  running = (async () => {
    try { do { again = false; await syncOnce(); } while (again && S); }
    finally { running = null; }
  })();
  return running;
}
export const scheduleSync = debounce(() => { syncNow(); }, 4000);

/** Sync after local saves, when the app comes back into view, and every couple of minutes. */
export function installSyncTriggers() {
  onSaved(() => { if (!merging && isSignedIn() && validToken()) scheduleSync(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && validToken()) syncNow(); });
  window.addEventListener('online', () => { if (validToken()) syncNow(); });
  setInterval(() => { if (document.visibilityState === 'visible' && validToken()) syncNow(); }, 120_000);
}

/* ---------- one pass ---------- */
async function syncOnce() {
  if (!validToken()) { setState('paused'); return; }
  if (navigator.onLine === false) { setState('offline'); return; }
  setState('syncing');
  try {
    let file = meta.fileId ? await getFileMeta(meta.fileId) : null;
    let extras = [];
    if (!file) { const files = await listSyncFiles(); file = files[0] || null; extras = files.slice(1); }
    if (!S) return;

    let remoteFp = null;
    if (file && (file.version !== meta.version || extras.length)) {
      for (const f of [file, ...extras]) {
        const data = await openCloudCopy(JSON.parse(await downloadFile(f.id)));
        if (!data || !S) return;            // waiting for a PIN, or the app was locked meanwhile
        if (f === file) remoteFp = syncFingerprint(data, stripPrivate);
        await mergeIn(data);
      }
      meta.fileId = file.id; meta.version = file.version;
    }

    if (!S) return;
    const fp = syncFingerprint(S, stripPrivate);
    const lockAt = vault.lockAt || 0;
    if (!file || forcePush || fp !== (remoteFp ?? meta.fingerprint) || lockAt !== (meta.lockAt || 0) || extras.length) {
      // Another device may have saved while we merged: if so, go round again before writing.
      if (file) {
        const now = await getFileMeta(file.id);
        if (now && now.version !== file.version) { again = true; await saveMeta(); return; }
      }
      const up = await uploadFile(file ? file.id : null, await buildRecord());
      meta.fileId = up.id; meta.version = up.version; forcePush = false;
      for (const f of extras) await deleteFile(f.id);
    }
    meta.fingerprint = fp; meta.lockAt = lockAt; meta.firstSync = false; meta.lastSync = Date.now();
    await saveMeta();
    setState('idle');
  } catch (e) {
    if (e instanceof AuthError) { forgetToken(); setState('paused'); return; }
    console.warn('Sync failed', e);
    setState(navigator.onLine === false ? 'offline' : 'error', e.message || 'Sync failed');
  }
}

/** Decrypt a cloud record if needed; returns its data, or null while a PIN is needed. Adopts newer lock settings. */
async function openCloudCopy(rec) {
  let data = null, keyInfo = null;
  if (!rec.enc) data = rec.data;
  else {
    for (const v of [vault.enc && vault.key ? vault : null, remoteVault]) {
      if (!v) continue;
      try { data = JSON.parse(dec(await aesDec(v.key, rec.payload))); keyInfo = v; break; } catch (e) { }
    }
    if (!data) { pendingRec = rec; setState('needs-pin'); return null; }
  }
  const remoteAt = rec.lockAt || 0, localAt = vault.lockAt || 0;
  // When both sides changed the lock at the same moment (or never), the encrypted side wins.
  if (remoteAt === localAt && vault.enc && !rec.enc) forcePush = true;
  if (remoteAt > localAt || (remoteAt === localAt && rec.enc && !vault.enc)) {
    if (rec.enc) {
      const wasOn = vault.enc;
      setVault({ enc: true, raw: keyInfo.raw, key: keyInfo.key, meta: { pin: rec.pin, rec: rec.rec }, lockAt: rec.lockAt });
      hooks.notify(wasOn ? 'Your app lock PIN was updated from another device.' : 'App lock is now on — it was turned on on another device.');
    } else if (vault.enc) {
      setVault({ enc: false, lockAt: rec.lockAt });
      hooks.notify('App lock was turned off on another device.');
    } else vault.lockAt = rec.lockAt;
  }
  return migrate(data);
}

async function mergeIn(data) {
  let changed;
  if (meta.firstSync && isPristine(S)) {
    // A fresh install: take the cloud copy as it is.
    changed = new Set([...S.notes, ...data.notes].map(n => n.id));
    Object.assign(S, { notes: data.notes, notebooks: data.notebooks, attachments: data.attachments, tombstones: data.tombstones });
    if (!S.settings.name && data.settings && data.settings.name) S.settings.name = data.settings.name;
  } else {
    changed = syncMerge(S, data);
    if (meta.firstSync) for (const id of dedupeStarter(S)) changed.add(id);
  }
  for (const id of changed) delete privKeys[id];   // replaced private entries must be unlocked again
  if (!changed.size) return;
  merging = true;
  try { await persist(); } finally { merging = false; }
  hooks.onRemoteData(changed);
}
