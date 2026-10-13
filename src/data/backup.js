/* Getting the note out (Markdown, backups) and back in (restore). */
import { ymd, download, dec } from '../lib/util.js';
import { aesDec } from '../lib/crypto.js';
import { store, KEY } from '../lib/storage.js';
import { APP } from './constants.js';
import { S, vault, note, migrate } from './state.js';
import { persist } from './persist.js';
import { openRecord } from './vault.js';
import { needsCombine, combineNotes } from './combine.js';
import { promptModal } from '../ui/modal.js';

/** The note as plain Markdown, with images embedded so the file stands alone. */
export function noteAsMarkdown() {
  return note().body.replace(/\(attachment:([a-z0-9]+)\)/gi, (m, id) => S.attachments[id] ? `(${S.attachments[id].data})` : m) + '\n';
}
export function downloadMarkdown() { download(`J Notes ${ymd()}.md`, noteAsMarkdown(), 'text/markdown'); }

export async function exportBackup(encrypted) {
  await persist();
  if (encrypted) download(`J Notes encrypted backup ${ymd()}.json`, store.get(KEY), 'application/json');
  else download(`J Notes backup ${ymd()}.json`, JSON.stringify({ v: 1, app: APP, enc: false, exported: new Date().toISOString(), data: S }, null, 1), 'application/json');
}

/**
 * Read a backup file (any J Notes version). Returns single-note data, or null if it can't be opened.
 * Throws an Error with a readable message for files that aren't backups or a wrong PIN.
 */
export async function readBackup(text) {
  let rec; try { rec = JSON.parse(text); } catch (e) { throw new Error('That file is not a J Notes backup.'); }
  let data = null;
  if (rec && rec.enc && rec.payload) {
    if (vault.enc && vault.key) { try { data = JSON.parse(dec(await aesDec(vault.key, rec.payload))); } catch (e) { data = null; } }
    if (!data) {
      const pin = await promptModal({ title: 'Encrypted backup', label: 'Enter the PIN that was in use when this backup was made', type: 'password', ok: 'Open backup' });
      if (!pin) return null;
      try { data = (await openRecord(rec, pin)).data; } catch (e) { throw new Error('That PIN does not open this backup.'); }
    }
  } else data = rec && rec.data;
  if (!data || !Array.isArray(data.notes)) throw new Error('That file is not a J Notes backup.');
  migrate(data);
  return needsCombine(data) ? combineNotes(data).data : data;
}
