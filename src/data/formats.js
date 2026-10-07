/* Pure Markdown/backup format helpers (no DOM, no app state) — shared by import, export and tests. */
import { longDate } from '../lib/util.js';
import { MOODS, ENERGY } from './constants.js';
import { newNote } from './state.js';

export function frontMatter(n, notebooks) {
  const nb = notebooks.find(b => b.id === n.notebookId);
  const q = s => JSON.stringify(String(s));
  let y = '---\n';
  y += `title: ${q(n.title || (n.type === 'diary' ? longDate(n.date) : 'Untitled'))}\n`;
  y += `id: ${n.id}\ntype: ${n.type}\n`;
  if (n.date) y += `date: ${n.date}\n`;
  y += `created: ${new Date(n.created).toISOString()}\nupdated: ${new Date(n.updated).toISOString()}\n`;
  if (nb) y += `notebook: ${q(nb.name)}\n`;
  if (n.tags.length) y += `tags: [${n.tags.map(q).join(', ')}]\n`;
  if (n.mood) y += `mood: ${MOODS[n.mood].n.toLowerCase()}\n`;
  if (n.energy != null) y += `energy: ${ENERGY[n.energy].toLowerCase()}\n`;
  if (n.pinned) y += 'pinned: true\n';
  if (n.fav) y += 'favorite: true\n';
  if (n.priv) y += 'private: true\n';
  return y + '---\n\n';
}

export function parseFrontMatter(txt) {
  const m = txt.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { meta: {}, body: txt };
  const meta = {};
  m[1].split(/\r?\n/).forEach(line => {
    const k = line.match(/^([\w-]+):\s*(.*)$/); if (!k) return;
    let v = k[2].trim();
    if (/^\[.*\]$/.test(v)) v = v.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    else v = v.replace(/^["']|["']$/g, '');
    meta[k[1].toLowerCase()] = v;
  });
  return { meta, body: txt.slice(m[0].length) };
}

/** Turn one Markdown/text file into a note (or diary entry). */
export function noteFromMarkdown(fileName, text, lastModified, notebookId = () => null) {
  const { meta, body } = parseFrontMatter(text);
  const isDiary = meta.type === 'diary' && /^\d{4}-\d{2}-\d{2}$/.test(meta.date || '');
  const title = meta.title || fileName.replace(/\.(md|markdown|txt)$/i, '');
  const tags = Array.isArray(meta.tags) ? meta.tags : meta.tags ? String(meta.tags).split(/[,\s]+/) : [];
  const n = newNote({
    title: isDiary && title === longDate(meta.date) ? '' : title, body: body.replace(/^\s+/, ''),
    tags: [...new Set(tags.map(t => t.replace(/^#/, '').toLowerCase()).filter(Boolean))],
    created: Date.parse(meta.created) || lastModified || Date.now(), updated: Date.parse(meta.updated) || lastModified || Date.now(),
    notebookId: isDiary ? null : notebookId(meta.notebook), pinned: meta.pinned === 'true', fav: meta.favorite === 'true'
  });
  if (isDiary) { n.type = 'diary'; n.date = meta.date; const mi = MOODS.findIndex(x => x && x.n.toLowerCase() === meta.mood); n.mood = mi > 0 ? mi : null; }
  return n;
}

/** Merge backup data into `target`: new notes are added, newer versions replace older ones. */
export function mergeData(target, data, keepIds = {}) {
  let added = 0, updated = 0;
  for (const nb of data.notebooks) if (!target.notebooks.some(b => b.id === nb.id)) target.notebooks.push(nb);
  Object.assign(target.attachments, data.attachments);
  for (const n of data.notes) {
    const i = target.notes.findIndex(x => x.id === n.id);
    if (i < 0) { target.notes.push(n); added++; }
    else if (n.updated > target.notes[i].updated && !keepIds[n.id]) { target.notes[i] = n; updated++; }
  }
  return { added, updated };
}

/* ---------- sync ---------- */

/** Replace a note's fields in place, so anything holding the object (the open editor) stays valid. */
function replaceInPlace(target, src) {
  for (const k of Object.keys(target)) if (!(k in src)) delete target[k];
  Object.assign(target, src);
}

/**
 * Merge a synced copy into local data, in place. Per note and notebook the newer `updated`
 * wins; tombstones remove items deleted elsewhere; attachments are combined.
 * Settings stay per device. Returns the ids of local notes that were added, replaced or removed.
 */
export function syncMerge(local, remote) {
  const changed = new Set(), tomb = local.tombstones;
  for (const [id, t] of Object.entries(remote.tombstones || {})) if (!(tomb[id] >= t)) tomb[id] = t;

  for (const nb of remote.notebooks || []) {
    const mine = local.notebooks.find(b => b.id === nb.id);
    if (!mine) local.notebooks.push({ ...nb });
    else if ((nb.updated || 0) > (mine.updated || 0)) Object.assign(mine, nb);
  }
  local.notebooks = local.notebooks.filter(b => !(tomb[b.id] >= (b.updated || 0)));

  for (const [id, a] of Object.entries(remote.attachments || {})) if (!local.attachments[id]) local.attachments[id] = a;

  for (const n of remote.notes || []) {
    const mine = local.notes.find(x => x.id === n.id);
    if (!mine) { if (!(tomb[n.id] >= n.updated)) { local.notes.push(n); changed.add(n.id); } }
    else if (n.updated > mine.updated) { replaceInPlace(mine, n); changed.add(n.id); }
  }
  local.notes = local.notes.filter(n => {
    const dead = tomb[n.id] >= n.updated;
    if (dead) changed.add(n.id);
    return !dead;
  });

  const nbIds = new Set(local.notebooks.map(b => b.id));
  for (const n of local.notes) if (n.notebookId && !nbIds.has(n.notebookId)) n.notebookId = null;
  return changed;
}

/** True for a fresh install that only holds the untouched starter content. */
export function isPristine(d) {
  if (Object.keys(d.tombstones || {}).length || Object.keys(d.attachments || {}).length) return false;
  if (d.notes.some(n => n.id !== 'welcome' || n.updated !== n.created)) return false;
  return d.notebooks.every(b => b.id.startsWith('nb-') && !b.updated);
}

/** The synced part of the data, as a stable string (private note bodies excluded). */
export function syncFingerprint(d, stripPrivate) {
  return JSON.stringify({ notes: d.notes, notebooks: d.notebooks, tombstones: d.tombstones, attachments: Object.keys(d.attachments).sort() }, stripPrivate);
}

/**
 * First sync between two existing installs: older versions gave the starter notebooks random
 * ids, so the same "Personal" notebook can appear twice. Fold same-named notebooks into one
 * (the same choice on every device) and drop an untouched duplicate welcome note.
 * Returns ids of notes that changed.
 */
export function dedupeStarter(d) {
  const changed = new Set(), now = Date.now(), byName = new Map();
  for (const b of [...d.notebooks].sort((a, b) => a.id.localeCompare(b.id))) {
    const k = b.name.trim().toLowerCase();
    const keep = byName.get(k);
    if (!keep) { byName.set(k, b); continue; }
    for (const n of d.notes) if (n.notebookId === b.id) { n.notebookId = keep.id; n.updated = now; changed.add(n.id); }
    d.notebooks = d.notebooks.filter(x => x !== b);
    d.tombstones[b.id] = now;
  }
  const welcome = d.notes.find(n => n.id === 'welcome');
  if (welcome && welcome.updated === welcome.created && d.notes.some(n => n !== welcome && n.title === welcome.title)) {
    d.notes = d.notes.filter(n => n !== welcome);
    d.tombstones[welcome.id] = now;
    changed.add(welcome.id);
  }
  return changed;
}
