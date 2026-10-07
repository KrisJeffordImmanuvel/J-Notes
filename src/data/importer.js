/* Import: Markdown/text files (with optional front-matter) and J Notes backups (merged, never downgraded). */
import { uid, dec } from '../lib/util.js';
import { aesDec } from '../lib/crypto.js';
import { S, vault, privKeys, migrate } from './state.js';
import { noteFromMarkdown, mergeData } from './formats.js';
import { persist } from './persist.js';
import { openRecord } from './vault.js';
import { toast } from '../ui/toast.js';
import { promptModal } from '../ui/modal.js';
import { render } from '../ui/nav.js';

export function notebookByName(name) {
  if (!name) return null;
  let nb = S.notebooks.find(b => b.name.toLowerCase() === String(name).toLowerCase());
  if (!nb) { nb = { id: uid(), name: String(name), updated: Date.now() }; S.notebooks.push(nb); }
  return nb.id;
}

export async function importFiles(fileList) {
  let count = 0;
  for (const f of fileList) {
    const name = f.name.toLowerCase();
    if (name.endsWith('.json')) { await importBackupText(await f.text()); continue; }
    if (!/\.(md|markdown|txt)$/.test(name)) continue;
    S.notes.push(noteFromMarkdown(f.name, await f.text(), f.lastModified, notebookByName)); count++;
  }
  if (count) { await persist(); render(); toast(`Imported ${count} note${count > 1 ? 's' : ''}`); }
}

export async function importBackupText(txt) {
  let rec; try { rec = JSON.parse(txt); } catch (e) { toast('That file is not a J Notes backup.'); return; }
  let data;
  if (rec && rec.enc) {
    if (vault.enc && vault.raw && rec.pin && rec.payload) {
      try { data = JSON.parse(dec(await aesDec(vault.key, rec.payload))); } catch (e) { data = null; }
    }
    if (!data) {
      const pin = await promptModal({ title: 'Encrypted backup', label: 'Enter the PIN used when this backup was made', type: 'password', ok: 'Decrypt' });
      if (!pin) return;
      try { data = (await openRecord(rec, pin)).data; } catch (e) { toast('Wrong PIN for this backup.'); return; }
    }
  } else data = rec && rec.data;
  if (!data || !Array.isArray(data.notes)) { toast('That file is not a J Notes backup.'); return; }
  migrate(data);
  const { added, updated } = mergeData(S, data, privKeys);
  await persist(); render();
  toast(`Merged backup: ${added} new, ${updated} updated`);
}
