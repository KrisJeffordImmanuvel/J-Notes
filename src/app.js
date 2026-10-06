/* Boot sequence: open storage, unlock (if needed) and start the app. */
import { prefs, initStore, store, KEY, THEMEKEY } from './lib/storage.js';
import { setAttachmentResolver } from './lib/markdown.js';
import { S, UI, setS, setVault, defaultData, migrate, purgeTrash } from './data/state.js';
import { persist, getSnaps } from './data/persist.js';
import { restoreFolder } from './data/folder.js';
import { toast } from './ui/toast.js';
import { render, applySettings, openDiaryDate, createNote } from './ui/nav.js';
import { ymd } from './lib/util.js';
import { showLock } from './ui/lock.js';
import { onboarding } from './ui/onboarding.js';

setAttachmentResolver(id => { const a = S && S.attachments[id]; return a ? a.data : null; });

export function start() {
  purgeTrash(); applySettings();
  UI.view = 'home'; UI.current = null; UI.focus = false;
  render(); persist();
  if (store.mode === 'memory') toast('This browser is blocking storage — notes will not be kept. Open J Notes in a normal (non-private) window.', null, 10000);
  if (!S.settings.onboarded) setTimeout(() => onboarding(1), 200);
  else openFromUrl();
}

/** App shortcuts from the manifest: ?open=today | ?open=new */
function openFromUrl() {
  const p = new URLSearchParams(location.search), what = p.get('open');
  if (!what) return;
  history.replaceState(null, '', location.pathname);
  if (what === 'today') openDiaryDate(ymd(), true);
  else if (what === 'new') createNote();
}

export async function boot() {
  const th = prefs.get(THEMEKEY) || 'auto';
  document.documentElement.dataset.theme = th === 'auto' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : th;
  await initStore();
  await restoreFolder();
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
