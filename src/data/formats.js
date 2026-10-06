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
