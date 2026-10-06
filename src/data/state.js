/* In-memory state: user data (decrypted), vault keys and UI state, plus data helpers. */
import { uid, parseYmd } from '../lib/util.js';
import { DEFAULT_SETTINGS } from './constants.js';

export let S = null;                    // all user data (decrypted, in memory)
export let vault = { enc: false };      // { enc:true, raw, key, meta:{pin,rec} }
export const privKeys = {};             // per-note keys for unlocked private entries
export const UI = { view: 'home', filter: { kind: 'all' }, current: null, preview: false, mobileEditor: false, diaryMonth: null, diaryDate: null, listQ: '', sort: 'updated', focus: false };

export const setS = v => { S = v; };
export const setVault = v => { vault = v; };

export function newNote(over = {}) {
  const t = Date.now();
  return Object.assign({ id: uid(), type: 'note', title: '', body: '', notebookId: null, tags: [], pinned: false, fav: false, created: t, updated: t, deleted: null, history: [] }, over);
}

export function defaultData() {
  const gs = uid();
  const welcome = newNote({
    title: 'Welcome to J Notes', notebookId: gs, pinned: true, tags: ['start'],
    body: `J Notes is a calm, private place for your notes and your diary. Everything stays **on this device** — there is no account, no tracking and no ads.

## Try these first
- [ ] Write today's diary entry (press **Alt + D**)
- [ ] Create a note (press **Alt + N**)
- [ ] Search everything (press **Ctrl + K**)
- [ ] Turn on the app lock in **Settings → Security** to encrypt your notes
- [ ] Download a backup in **Settings → Backup & export**

## Writing
Notes are saved as plain Markdown, so they stay readable forever. Use the toolbar or type:
**bold**, *italic*, ==highlight==, \`code\`, "- [ ]" for a checklist and "#" for a heading.

> Tip: switch to **Power mode** in Settings for [[note links]], backlinks and templates.

## Never lose a word
Every note keeps a version history, deleted notes wait 30 days in the Trash, and J Notes takes a daily snapshot automatically.

## Take it with you
Install J Notes from your browser's menu (“Install app” or “Add to Home Screen”) and it works fully offline.`
  });
  return {
    v: 1, settings: { ...DEFAULT_SETTINGS },
    notebooks: [{ id: gs, name: 'Getting started' }, { id: uid(), name: 'Personal' }, { id: uid(), name: 'Work' }],
    notes: [welcome], attachments: {}
  };
}

export function migrate(d) {
  d.settings = Object.assign({}, DEFAULT_SETTINGS, d.settings || {});
  d.notebooks = d.notebooks || []; d.notes = d.notes || []; d.attachments = d.attachments || {};
  d.notes.forEach(n => { n.tags = n.tags || []; n.history = n.history || []; if (n.deleted === undefined) n.deleted = null; });
  return d;
}

/** JSON replacer: private notes never leave memory in readable form. */
export const stripPrivate = (k, v) => (v && typeof v === 'object' && v.priv && v.id) ? { ...v, body: '', history: [] } : v;

/* ---------- selectors ---------- */
export const cur = () => S && S.notes.find(n => n.id === UI.current);
export const live = () => S.notes.filter(n => !n.deleted);
export const diaryFor = d => S.notes.find(n => n.type === 'diary' && n.date === d && !n.deleted);
export const nbName = id => (S.notebooks.find(b => b.id === id) || {}).name || '';
export const isMobile = () => matchMedia('(max-width:820px)').matches;
export const allTags = () => [...new Set(live().flatMap(n => n.tags))].sort();
export const noteTitle = n => n.type === 'diary' ? (n.title || parseYmd(n.date).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })) : (n.title || 'Untitled');
export const isLockedPriv = n => !!n.priv && !privKeys[n.id];
export function isEmptyNote(n) {
  return !n.title.trim() && !n.body.trim() && !n.priv && !n.tags.length && !n.mood && n.energy == null;
}

/** Keep a version every few minutes while writing (and on demand), 40 at most. */
export function snapshotHistory(n, force) {
  if (!n || n.priv) return;
  const h = n.history, last = h[h.length - 1];
  if (last && last.title === n.title && last.body === n.body) return;
  if (!n.body.trim() && !n.title.trim()) return;
  if (!force && last && Date.now() - last.t < 5 * 60e3) return;
  h.push({ t: Date.now(), title: n.title, body: n.body });
  if (h.length > 40) h.splice(0, h.length - 40);
}

/** Delete notes that have been in the Trash for 30 days and unreferenced attachments. */
export function purgeTrash() {
  const cutoff = Date.now() - 30 * 864e5;
  S.notes = S.notes.filter(n => !n.deleted || n.deleted > cutoff);
  // Private notes keep their text encrypted, so we can't tell which images they use — keep all.
  if (!S.notes.some(n => n.priv)) {
    const text = S.notes.map(n => n.body + n.history.map(h => h.body).join('')).join('\n');
    for (const id of Object.keys(S.attachments)) if (!text.includes('attachment:' + id)) delete S.attachments[id];
  }
}
