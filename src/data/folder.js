/* Folder sync via the File System Access API (Chromium on desktop).
 * The chosen folder is remembered in IndexedDB; after a browser restart the user
 * re-grants access with one click ("Reconnect folder"). */
import { debounce } from '../lib/util.js';
import { store, FOLDERKEY } from '../lib/storage.js';
import { vault } from './state.js';
import { exportFiles } from './exporter.js';
import { importBackupText } from './importer.js';
import { persist } from './persist.js';
import { toast } from '../ui/toast.js';
import { renderSettingsIfOpen } from '../ui/settings.js';

export const fsOK = typeof window !== 'undefined' && 'showDirectoryPicker' in window;
export const folder = {
  handle: null,      // active, permission granted
  pending: null,     // remembered from an earlier session, waiting for permission
  md: true,          // also write readable Markdown copies
  last: 0            // time of the last successful write
};

async function remember() {
  if (!store.structured) return;
  const h = folder.handle || folder.pending;
  if (h) await store.set(FOLDERKEY, { handle: h, md: folder.md }); else await store.del(FOLDERKEY);
}

/** On start-up: pick up a remembered folder if the browser still allows access. */
export async function restoreFolder() {
  if (!fsOK) return;
  const saved = store.get(FOLDERKEY);
  if (!saved || !saved.handle) return;
  folder.md = saved.md !== false;
  try {
    const p = await saved.handle.queryPermission({ mode: 'readwrite' });
    if (p === 'granted') folder.handle = saved.handle; else folder.pending = saved.handle;
  } catch (e) { folder.pending = saved.handle; }
}

/** Ask for permission again on a remembered folder (needs a click). */
export async function reconnectFolder() {
  const h = folder.pending; if (!h) return chooseFolder();
  try {
    if (await h.requestPermission({ mode: 'readwrite' }) === 'granted') {
      folder.handle = h; folder.pending = null; folder.last = 0;
      toast(`Syncing to folder “${h.name}”`); await persist();
    } else toast('Permission was not granted.');
  } catch (e) { toast('Could not reconnect — choose the folder again.'); }
  renderSettingsIfOpen();
}

export async function chooseFolder() {
  try {
    folder.handle = await window.showDirectoryPicker({ id: 'jnotes', mode: 'readwrite' });
    folder.pending = null; folder.last = 0;
    await remember();
    toast(`Syncing to folder “${folder.handle.name}”`); await persist(); renderSettingsIfOpen();
  } catch (e) { if (e.name !== 'AbortError') toast('Could not open that folder.'); }
}

export async function forgetFolder() { folder.handle = null; folder.pending = null; await remember(); renderSettingsIfOpen(); }
export async function setFolderMd(on) { folder.md = on; folder.last = 0; await remember(); await persist(); }

export const folderWrite = debounce(async rec => {
  const dir0 = folder.handle; if (!dir0) return;
  try {
    const writeFile = async (dir, name, data) => { const fh = await dir.getFileHandle(name, { create: true }); const w = await fh.createWritable(); await w.write(data); await w.close(); };
    await writeFile(dir0, 'jnotes-vault.json', rec);
    if (folder.md && !vault.enc) {
      for (const f of exportFiles()) {
        if (f.updated && f.updated <= folder.last) continue;
        const parts = f.name.split('/'); let dir = dir0;
        for (const p of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(p, { create: true });
        await writeFile(dir, parts[parts.length - 1], f.data);
      }
    }
    folder.last = Date.now();
  } catch (e) {
    console.warn(e);
    toast('Folder sync paused: permission was lost. Reconnect the folder in Settings → Backup.');
    folder.pending = folder.handle; folder.handle = null;
  }
}, 1500);

export async function mergeFromFolder() {
  if (!folder.handle) return;
  let txt;
  try { txt = await (await (await folder.handle.getFileHandle('jnotes-vault.json')).getFile()).text(); }
  catch (e) { toast('No jnotes-vault.json found in that folder yet.'); return; }
  await importBackupText(txt);
}
