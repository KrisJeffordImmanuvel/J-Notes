/* Boot sequence: open storage, unlock, bring old data into the single-note format, and show the note. */
import { prefs, initStore, store, KEY, THEMEKEY, OBSOLETE_KEYS } from './lib/storage.js';
import { setAttachmentResolver } from './lib/markdown.js';
import { S, UI, vault, setS, setVault, defaultData, migrate, pruneAttachments } from './data/state.js';
import { PIN_REQUIRED } from './data/constants.js';
import { persist, getSnaps, dailySnapshot } from './data/persist.js';
import { needsCombine, combineNotes } from './data/combine.js';
import { toast } from './ui/toast.js';
import { render } from './ui/view.js';
import { showLock, requirePin } from './ui/lock.js';

setAttachmentResolver(id => { const a = S && S.attachments[id]; return a ? a.data : null; });

export async function start() {
  if (needsCombine(S)) await combineOldData();
  pruneAttachments();
  UI.preview = false; UI.focus = false;
  render(); persist();
  if (store.mode === 'memory') toast('This browser is blocking storage — your note will not be kept. Open J Notes in a normal (non-private) window.', null, 10000);
  if (PIN_REQUIRED && !vault.enc) setTimeout(requirePin, 100);   // the note always sits behind a PIN
}

/** Version 1 kept many notes and a diary: keep a snapshot of it, then fold everything into the one note. */
async function combineOldData() {
  const before = store.get(KEY);
  if (before) await dailySnapshot(before, true, 'Before the single-note update');
  const { data, count } = combineNotes(S);
  data.settings = S.settings;
  setS(migrate(data));
  await persist();
  if (count > 1) toast(`Your ${count} notes and diary entries are now one note, each under its own heading. The old version is kept as a snapshot in Settings → Backup.`, null, 12000);
}

export async function boot() {
  const th = prefs.get(THEMEKEY) || 'auto';
  document.documentElement.dataset.theme = th === 'auto' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : th;
  await initStore();
  for (const k of OBSOLETE_KEYS) if (store.get(k) != null) store.del(k);
  openData();
}

function openData(recovered) {
  const raw = store.get(KEY);
  if (!raw) { setS(defaultData()); setVault({ enc: false }); start(); return; }
  let rec = null; try { rec = JSON.parse(raw); } catch (e) { }
  if (!rec || (rec.enc ? !rec.payload : !rec.data)) {
    const snaps = getSnaps();
    if (snaps.length && !recovered) {
      // keep the damaged record aside rather than overwriting it silently
      store.set(KEY + ':damaged', raw);
      store.set(KEY, snaps[snaps.length - 1].rec).then(() => { toast('Your data was damaged — restored the latest snapshot.', null, 8000); openData(true); });
      return;
    }
    setS(defaultData()); setVault({ enc: false }); start(); return;
  }
  if (rec.enc) { setVault({ enc: true, meta: { pin: rec.pin, rec: rec.rec } }); showLock(); }
  else { setS(migrate(rec.data)); setVault({ enc: false }); start(); }
}
