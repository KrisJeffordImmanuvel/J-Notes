/* Moving from the old multi-note format (v1: notes, notebooks, diary) to one note (v2). Pure — no DOM. */
import { longDate } from '../lib/util.js';
import { DATA_VERSION, NOTE_ID, emptyNote } from './state.js';

const MOODS = [null, 'Rough', 'Low', 'Okay', 'Good', 'Great'], ENERGY = ['Low', 'Medium', 'High'];

export const needsCombine = d => d.v !== DATA_VERSION;

/** The untouched sample note older versions created on first start. */
const isSample = n => n.title === 'Welcome to J Notes' && /^J Notes is a calm, private place/.test(n.body || '');

function section(n) {
  const head = n.type === 'diary' && n.date ? `${longDate(n.date)}${n.title ? ' — ' + n.title : ''}` : (n.title || 'Untitled');
  const lines = [`## ${head}`];
  const meta = [];
  if (n.type === 'diary' && n.mood) meta.push(`Mood: ${MOODS[n.mood]}`);
  if (n.type === 'diary' && n.energy != null) meta.push(`Energy: ${ENERGY[n.energy]}`);
  if (n.tags && n.tags.length) meta.push(n.tags.map(t => '#' + t).join(' '));
  if (meta.length) lines.push(`*${meta.join(' · ')}*`);
  lines.push(n.priv ? '_This was a password-protected entry. Its text is kept in the backup snapshot taken before this update._' : (n.body || '').trim());
  return lines.join('\n\n');
}

/**
 * Turn old data into a single note: every live note and diary entry, oldest first,
 * each under its own heading. Notes in the Trash and the untouched sample note are left out
 * (they remain in the snapshot taken before combining). Returns { data, count }.
 */
export function combineNotes(d) {
  const when = n => (n.type === 'diary' && n.date ? Date.parse(n.date + 'T12:00:00') : n.created) || 0;
  const keep = (d.notes || []).filter(n => !n.deleted && !isSample(n)).sort((a, b) => when(a) - when(b));
  let n;
  if (keep.length === 1 && keep[0].type !== 'diary' && !keep[0].title && !keep[0].priv) {
    n = emptyNote({ body: keep[0].body || '', created: keep[0].created, updated: keep[0].updated, history: (keep[0].history || []).map(h => ({ t: h.t, body: h.body })) });
  } else {
    n = emptyNote({ body: keep.map(section).join('\n\n---\n\n') });
    if (keep.length) n.created = Math.min(...keep.map(x => x.created || Date.now()));
  }
  n.id = NOTE_ID;
  const text = n.body;
  const attachments = {};
  for (const [id, a] of Object.entries(d.attachments || {})) if (text.includes('attachment:' + id)) attachments[id] = a;
  return { data: { v: DATA_VERSION, settings: d.settings || {}, notes: [n], attachments }, count: keep.length };
}
