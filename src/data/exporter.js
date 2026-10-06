/* Export: Markdown with YAML front-matter, ZIP of everything, JSON backups. */
import { enc, ymd, safeName, dataUrlBytes, extFor, download } from '../lib/util.js';
import { makeZip } from '../lib/zip.js';
import { store, KEY } from '../lib/storage.js';
import { APP } from './constants.js';
import { frontMatter } from './formats.js';
import { S, isLockedPriv, stripPrivate } from './state.js';
import { persist } from './persist.js';
import { toast } from '../ui/toast.js';

export function noteMarkdown(n, attPrefix = 'attachments/') {
  const body = isLockedPriv(n) ? '_This is a private entry. Its content stays encrypted and is not exported._' :
    n.body.replace(/\(attachment:([a-z0-9]+)\)/gi, (m, id) => { const a = S.attachments[id]; return a ? `(${attPrefix}${id}.${extFor(a.type)})` : m; });
  return frontMatter(n, S.notebooks) + body + '\n';
}

/** Every live note as a Markdown file (Diary/YYYY/…, <Notebook>/…) plus attachments. */
export function exportFiles() {
  const files = [], used = new Set();
  const uniq = p => { let name = p, i = 2; while (used.has(name.toLowerCase())) name = p.replace(/\.md$/, ` (${i++}).md`); used.add(name.toLowerCase()); return name; };
  for (const n of S.notes.filter(n => !n.deleted)) {
    let path, depth;
    if (n.type === 'diary') { path = `Diary/${n.date.slice(0, 4)}/${n.date}${n.title ? ' ' + safeName(n.title) : ''}.md`; depth = 2; }
    else { const nb = S.notebooks.find(b => b.id === n.notebookId); path = `${nb ? safeName(nb.name) : 'Notes'}/${safeName(n.title)}.md`; depth = 1; }
    files.push({ name: uniq(path), data: enc(noteMarkdown(n, '../'.repeat(depth) + 'attachments/')), updated: n.updated });
  }
  for (const [id, a] of Object.entries(S.attachments)) files.push({ name: `attachments/${id}.${extFor(a.type)}`, data: dataUrlBytes(a.data).bytes, updated: a.t || 0 });
  return files;
}

export async function exportZip() {
  await persist();
  const files = exportFiles().map(f => ({ name: 'J Notes/' + f.name, data: f.data }));
  files.push({ name: 'J Notes/README.txt', data: enc(`Exported from J Notes on ${new Date().toString()}.\nEvery note is a plain Markdown file with YAML front-matter. Open them with any text editor, Obsidian, Joplin, VS Code and more.\n`) });
  download(`J Notes export ${ymd()}.zip`, makeZip(files));
  toast(`Exported ${S.notes.filter(n => !n.deleted).length} notes as Markdown`);
}

export async function exportBackup(encrypted) {
  await persist();
  if (encrypted) download(`J Notes encrypted backup ${ymd()}.json`, store.get(KEY), 'application/json');
  else download(`J Notes backup ${ymd()}.json`, JSON.stringify({ v: 1, app: APP, enc: false, exported: new Date().toISOString(), data: JSON.parse(JSON.stringify(S, stripPrivate)) }, null, 1), 'application/json');
}
