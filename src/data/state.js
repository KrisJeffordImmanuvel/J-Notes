/* In-memory state: the note (decrypted), the vault keys and a little UI state. */
import { DEFAULT_SETTINGS } from './constants.js';

/** Data format 2: exactly one note. (Format 1 held many notes and a diary.) */
export const DATA_VERSION = 2, NOTE_ID = 'note';

export let S = null;                    // { v, settings, notes: [the note], attachments }
export let vault = { enc: false };      // { enc:true, raw, key, meta:{pin,rec} }
export const UI = { preview: false, focus: false };

export const setS = v => { S = v; };
export const setVault = v => { vault = v; };
export const note = () => S.notes[0];

export function emptyNote(over = {}) {
  const t = Date.now();
  return { id: NOTE_ID, body: '', created: t, updated: t, history: [], ...over };
}
export function defaultData() {
  return { v: DATA_VERSION, settings: { ...DEFAULT_SETTINGS }, notes: [emptyNote()], attachments: {} };
}

/** Fill in defaults on loaded data (it may be format 1 — see combine.js). */
export function migrate(d) {
  d.settings = Object.assign({}, DEFAULT_SETTINGS, d.settings || {});
  d.notes = d.notes || []; d.attachments = d.attachments || {};
  d.notes.forEach(n => { n.history = n.history || []; n.body = n.body || ''; });
  return d;
}

/** Keep a version every few minutes while writing (and on demand), 40 at most. */
export function snapshotHistory(n, force) {
  if (!n) return;
  const h = n.history, last = h[h.length - 1];
  if (last && last.body === n.body) return;
  if (!n.body.trim()) return;
  if (!force && last && Date.now() - last.t < 5 * 60e3) return;
  h.push({ t: Date.now(), body: n.body });
  if (h.length > 40) h.splice(0, h.length - 40);
}

/** Drop images the note (and its history) no longer uses. */
export function pruneAttachments() {
  const n = note(), text = n.body + n.history.map(h => h.body).join('');
  for (const id of Object.keys(S.attachments)) if (!text.includes('attachment:' + id)) delete S.attachments[id];
}
