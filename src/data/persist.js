/* Saving: debounced persistence, save status indicator and daily snapshots. */
import { $$, esc, enc, ymd } from '../lib/util.js';
import { aesEnc } from '../lib/crypto.js';
import { store, KEY, SNAP } from '../lib/storage.js';
import { APP } from './constants.js';
import { S, vault } from './state.js';
import { toast } from '../ui/toast.js';

export let saveState = 'saved', lastSaved = Date.now();
export const flags = { noSave: false };   // set before a reload that replaces the data

let saveTimer = null;
export function scheduleSave(ms = 450) { setSaveState('saving'); clearTimeout(saveTimer); saveTimer = setTimeout(persist, ms); }

/** Build the stored record (encrypted once the PIN is set). */
export async function buildRecord() {
  const json = JSON.stringify(S);
  if (vault.enc) return JSON.stringify({ v: 1, app: APP, enc: true, pin: vault.meta.pin, rec: vault.meta.rec, payload: await aesEnc(vault.key, enc(json)) });
  return JSON.stringify({ v: 1, app: APP, enc: false, data: JSON.parse(json) });
}

let persisting = null;
export async function persist() {
  clearTimeout(saveTimer);
  if (!S || flags.noSave) return;
  // Wait for any in-flight save, then save again so the latest edits are included.
  while (persisting) await persisting;
  persisting = (async () => {
    try {
      const rec = await buildRecord();
      if (store.mode === 'memory') { setSaveState('error', 'Storage unavailable — export a backup'); return; }
      if (!await store.set(KEY, rec)) { setSaveState('error', 'Storage full — export a backup'); toast('Could not save: browser storage is full. Remove large images or export a backup.'); return; }
      lastSaved = Date.now(); setSaveState('saved');
      await dailySnapshot(rec);
    } catch (e) { console.error(e); setSaveState('error', 'Save failed'); }
  })();
  try { await persisting; } finally { persisting = null; }
}

export function setSaveState(s, msg) {
  saveState = s;
  const txt = s === 'saving' ? 'Saving…' : s === 'error' ? (msg || 'Not saved') : 'Saved' + (vault.enc ? ' · encrypted' : '');
  $$('.js-status').forEach(el => { el.innerHTML = `<i class="status-dot ${s === 'saving' ? 'busy' : s === 'error' ? 'err' : ''}"></i><span class="lbl">${esc(txt)}</span>`; el.title = txt; });
}

/* ---------- snapshots (daily, keep 7) ---------- */
export function getSnaps() { try { return JSON.parse(store.get(SNAP) || '[]'); } catch (e) { return []; } }
export async function dailySnapshot(rec, force, label) {
  const today = ymd(); let snaps = getSnaps();
  if (!force && snaps.length && snaps[snaps.length - 1].date === today) return;
  if (force && !label) snaps = snaps.filter(s => s.date !== today || s.manual || s.label);
  snaps.push({ date: today, t: Date.now(), size: rec.length, rec, manual: !!force, ...(label ? { label } : {}) });
  // keep 7 everyday snapshots; labelled ones (e.g. "before the single-note update") are kept too
  const drop = () => { const i = snaps.findIndex(s => !s.label); if (i < 0) return false; snaps.splice(i, 1); return true; };
  while (snaps.filter(s => !s.label).length > 7 && drop());
  while (snaps.length && !await store.set(SNAP, JSON.stringify(snaps))) if (!drop()) snaps.shift();
}
/** Save now and take a manual snapshot of the current data. */
export async function snapshotNow() { await persist(); const rec = store.get(KEY); if (rec) await dailySnapshot(rec, true); }
