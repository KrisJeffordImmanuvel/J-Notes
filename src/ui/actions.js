/* Click/keyboard action handlers (event delegation), global shortcuts and timers. */
import { $, $$, uid, ymd, pad, esc, fmtTime } from '../lib/util.js';
import { store, KEY, SNAP, THEMEKEY, prefs, FOLDERKEY } from '../lib/storage.js';
import { PROMPTS } from '../data/constants.js';
import { S, UI, vault, cur, live, diaryFor, isEmptyNote, forgetNotes, forgetNotebook, setDeleted } from '../data/state.js';
import { scheduleSave, persist, saveState, getSnaps, snapshotNow, flags } from '../data/persist.js';
import { disableLock, newRecovery } from '../data/vault.js';
import { exportZip, exportBackup } from '../data/exporter.js';
import { chooseFolder, mergeFromFolder, reconnectFolder, forgetFolder } from '../data/folder.js';
import { closeModal, dismissModal, promptModal, confirmModal, openMenu, closeMenu, isModalOpen, isMenuOpen, isStickyModal } from './modal.js';
import { toast } from './toast.js';
import { render, renderMain, applySettings, go, openNote, createNote, openDiaryDate, leaveNote, closeNav } from './nav.js';
import { renderSidebar } from './sidebar.js';
import { renderList } from './notes.js';
import { refreshTags, touch, touchMeta, togglePreview, toggleFocus, nextPromptIdx } from './editor.js';
import { fmt, insertPrompt } from './format.js';
import { quickSave } from './home.js';
import { renderDiarySide, pickDate } from './diary.js';
import { openSearch } from './search.js';
import { openHistory } from './history.js';
import { openDiaryBook } from './print.js';
import { noteMenu } from './note-menu.js';
import { lockApp, setupLock, showRecovery } from './lock.js';
import { openSettings, renderSettings, setSettingsTab } from './settings.js';
import { installApp } from './pwa.js';
import { accountActions } from './account.js';
import { SYNCKEY } from '../data/sync.js';
import { forgetToken, personalMode } from '../lib/google.js';

const H = {
  closeModal: () => dismissModal(),
  newNote: () => createNote(),
  search: () => { closeNav(); openSearch(); },
  home: () => go('home'),
  diary: () => go('diary'),
  today: () => openDiaryDate(ymd(), true),
  filter: d => go('notes', d.kind === 'notebook' || d.kind === 'tag' ? { kind: d.kind, id: d.id } : { kind: d.kind }),
  openNote: d => openNote(d.id),
  openNoteM: d => { closeModal(); openNote(d.id); },
  openNav: () => $('#app').classList.add('nav-open'),
  closeNav: () => closeNav(),
  settings: d => { closeNav(); openSettings(d.tab); },
  settingsTab: d => { setSettingsTab(d.tab); renderSettings(); },
  setOpt: d => { S.settings[d.k] = d.v; applySettings(); scheduleSave(); renderSettings(); },
  lock: () => lockApp(),
  lockSetup: () => setupLock(),
  lockOff: async () => {
    if (personalMode()) return;   // the app lock always stays on in personal mode
    if (await confirmModal({ title: 'Turn off app lock?', text: 'Your notes will be stored without encryption on this device.', ok: 'Turn off', danger: true })) { await disableLock(); render(); toast('App lock turned off'); } },
  newRecovery: async () => { if (await confirmModal({ title: 'Create a new recovery key?', text: 'Your old recovery key will stop working.', ok: 'Create new key' })) showRecovery(await newRecovery()); },
  addNotebook: async () => { const name = await promptModal({ title: 'New notebook', label: 'Notebook name', ok: 'Create' }); if (name && name.trim()) { const b = { id: uid(), name: name.trim(), updated: Date.now() }; S.notebooks.push(b); scheduleSave(); go('notes', { kind: 'notebook', id: b.id }); } },
  nbMenu: (d, el) => {
    const nb = S.notebooks.find(b => b.id === d.id); if (!nb) return;
    openMenu(el, [
      { label: 'Rename', icon: 'edit', fn: async () => { const name = await promptModal({ title: 'Rename notebook', label: 'Name', value: nb.name, ok: 'Rename' }); if (name && name.trim()) { nb.name = name.trim(); nb.updated = Date.now(); scheduleSave(); render(); } } },
      { label: 'New note here', icon: 'plus', fn: () => { UI.view = 'notes'; UI.filter = { kind: 'notebook', id: nb.id }; createNote(); } },
      '-',
      { label: 'Delete notebook', icon: 'trash', danger: true, fn: async () => { if (await confirmModal({ title: `Delete “${nb.name}”?`, text: 'The notes inside are kept and moved to All notes.', ok: 'Delete notebook', danger: true })) { forgetNotebook(nb); scheduleSave(); go('notes', { kind: 'all' }); } } }
    ]);
  },
  sortMenu: (d, el) => openMenu(el, [['updated', 'Last edited'], ['created', 'Date created'], ['title', 'Title']].map(([k, l]) => ({ label: (UI.sort === k ? '✓ ' : '   ') + l, fn: () => { UI.sort = k; renderList(); } }))),
  mobileBack: () => { leaveNote(); UI.mobileEditor = false; if (UI.view !== 'diary') UI.current = null; renderMain(); renderSidebar(); },
  togglePin: (d, el) => { const n = cur(); n.pinned = !n.pinned; el.classList.toggle('on', n.pinned); touchMeta(n); },
  toggleFav: (d, el) => { const n = cur(); n.fav = !n.fav; el.classList.toggle('on', n.fav); touchMeta(n); },
  togglePreview: () => togglePreview(),
  toggleFocus: () => toggleFocus(),
  history: () => openHistory(cur()),
  noteMenu: (d, el) => noteMenu(el),
  fmt: d => fmt(d.f),
  rmTag: d => { const n = cur(); n.tags = n.tags.filter(t => t !== d.tag); touch(n); refreshTags(n); },
  addTagS: d => { const n = cur(); if (!n.tags.includes(d.tag)) n.tags.push(d.tag); touch(n); refreshTags(n); },
  setMood: (d) => { const n = cur(), v = +d.v; n.mood = n.mood === v ? null : v; $$('#moodRow .mood-btn').forEach(b => b.classList.toggle('sel', +b.dataset.v === n.mood)); touch(n); },
  setEnergy: (d) => { const n = cur(), v = +d.v; n.energy = n.energy === v ? null : v; $$('#energyRow .mood-btn').forEach(b => b.classList.toggle('sel', +b.dataset.v === n.energy)); touch(n); },
  usePrompt: () => { insertPrompt(); const pb = $('#promptBox'); if (pb) pb.remove(); },
  nextPrompt: () => { const t = $('#promptText'); if (t) t.textContent = PROMPTS[nextPromptIdx()]; },
  writeDiary: () => openDiaryDate(UI.diaryDate, true),
  pickDate: d => pickDate(d.date),
  calMove: d => { const [y, m] = UI.diaryMonth.split('-').map(Number); const nd = new Date(y, m - 1 + (+d.d), 1); UI.diaryMonth = `${nd.getFullYear()}-${pad(nd.getMonth() + 1)}`; renderDiarySide(); },
  diaryMenu: (d, el) => openMenu(el, [{ label: 'Create diary book (PDF)', icon: 'print', fn: openDiaryBook }, { label: 'Diary settings', icon: 'gear', fn: () => openSettings('diary') }]),
  diaryBook: () => openDiaryBook(),
  clearReminder: () => { S.settings.reminder = ''; scheduleSave(); renderSettings(); },
  quickSave: () => quickSave(),
  tidyEmpty: () => { const t = Date.now(); live().filter(n => n.type === 'note' && isEmptyNote(n)).forEach(n => { n.deleted = t; n.updated = t; }); scheduleSave(); render(); toast('Empty notes moved to Trash'); },
  restoreNote: () => { const n = cur(); setDeleted(n, false); scheduleSave(); UI.filter = { kind: 'all' }; openNote(n.id); toast('Note restored'); },
  destroyNote: async () => { const n = cur(); if (await confirmModal({ title: 'Delete forever?', text: 'This note and its history will be permanently removed.', ok: 'Delete forever', danger: true })) { forgetNotes([n]); UI.current = null; scheduleSave(); render(); } },
  emptyTrash: async () => { const c = S.notes.filter(n => n.deleted).length; if (!c) return; if (await confirmModal({ title: 'Empty Trash?', text: `${c} note${c > 1 ? 's' : ''} will be permanently deleted.`, ok: 'Empty Trash', danger: true })) { forgetNotes(S.notes.filter(n => n.deleted)); UI.current = null; scheduleSave(); render(); } },
  exportZip: () => exportZip(),
  exportJson: () => exportBackup(false),
  exportEnc: () => exportBackup(true),
  chooseFolder: () => chooseFolder(),
  mergeFolder: () => mergeFromFolder(),
  reconnectFolder: () => reconnectFolder(),
  forgetFolder: () => forgetFolder(),
  installApp: () => installApp(),
  snapNow: async () => { await snapshotNow(); renderSettings(); toast('Snapshot saved'); },
  restoreSnap: async d => {
    const s = getSnaps()[+d.i]; if (!s) return;
    if (!await confirmModal({ title: 'Restore snapshot?', text: `Replace everything with the snapshot from ${esc(fmtTime(s.t))}? A snapshot of your current data is taken first.${s.rec.includes('"enc":true') ? ' You will need the PIN that was active then.' : ''}`, ok: 'Restore' })) return;
    await snapshotNow();
    flags.noSave = true;
    if (!await store.set(KEY, s.rec)) { flags.noSave = false; toast('Could not restore that snapshot.'); return; }
    location.reload();
  },
  ...accountActions,
  eraseAll: async () => {
    const v = await promptModal({ title: 'Erase all data', label: 'Type ERASE to permanently delete all notes, diary entries and snapshots on this device.', ok: 'Erase everything' });
    if (v !== 'ERASE') { if (v !== null) toast('Nothing was erased.'); return; }
    flags.noSave = true;
    await Promise.all([store.del(KEY), store.del(SNAP), store.del(FOLDERKEY), store.del(SYNCKEY)]); prefs.del(THEMEKEY); forgetToken();
    location.reload();
  }
};

let lastActivity = Date.now();

/** Wire up delegated clicks, shortcuts, auto-save triggers and timers. Call once. */
export function installGlobalHandlers() {
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]'); if (!el || !S && el.dataset.act !== 'closeModal') return;
    const a = el.dataset.act; if (!H[a]) return;
    e.preventDefault(); e.stopPropagation(); H[a](el.dataset, el, e);
  });
  document.addEventListener('keydown', e => {
    lastActivity = Date.now();
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role=button][data-act]')) { e.preventDefault(); e.target.click(); return; }
    if (!S) return;
    const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (e.key === 'Escape') {
      if (isMenuOpen()) closeMenu(); else if (isModalOpen()) dismissModal(); else if (UI.focus) toggleFocus(); else closeNav();
      return;
    }
    if (isModalOpen() && (isStickyModal() || !(mod && k === 'k'))) return;
    if (mod && !e.altKey && k === 'k') { e.preventDefault(); if (isModalOpen()) closeModal(); openSearch(); }
    else if (mod && !e.altKey && k === 's') { e.preventDefault(); persist().then(() => toast('Saved')); }
    else if (mod && !e.altKey && k === 'e') { e.preventDefault(); togglePreview(); }
    else if (e.altKey && !mod) {
      const c = e.code;
      if (c === 'KeyN') { e.preventDefault(); createNote(); }
      else if (c === 'KeyD') { e.preventDefault(); openDiaryDate(ymd(), true); }
      else if (c === 'KeyF') { e.preventDefault(); if (cur()) toggleFocus(); }
      else if (c === 'KeyH') { e.preventDefault(); go('home'); }
      else if (c === 'KeyL' && vault.enc) { e.preventDefault(); lockApp(); }
    }
  });
  ['mousemove', 'mousedown', 'touchstart', 'scroll'].forEach(ev => document.addEventListener(ev, () => { lastActivity = Date.now(); }, { passive: true, capture: true }));
  // Save as soon as the page is hidden (tab switch, app switch, closing) — the most reliable moment.
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && S && !flags.noSave) persist(); });
  window.addEventListener('pagehide', () => { if (S && !flags.noSave && saveState === 'saving') persist(); });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (S && S.settings.theme === 'auto') applySettings(); });

  /* timers: auto-lock, reminders, relative times */
  setInterval(() => {
    if (!S) return;
    const st = S.settings;
    if (vault.enc && st.autolock > 0 && Date.now() - lastActivity > st.autolock * 60000) { lockApp(); return; }
    if (st.reminder) {
      const now = new Date(), hm = `${pad(now.getHours())}:${pad(now.getMinutes())}`, today = ymd();
      const e = diaryFor(today);
      if (hm >= st.reminder && st.lastReminder !== today && !(e && (e.priv || e.body.trim()))) {
        st.lastReminder = today; scheduleSave();
        toast('A quiet moment to write today’s entry?', { label: 'Write', fn: () => openDiaryDate(today, true) }, 12000);
        try { if ('Notification' in window && Notification.permission === 'granted' && document.visibilityState !== 'visible') new Notification('J Notes', { body: 'A quiet moment to write today’s entry?' }); } catch (err) { }
      }
    }
  }, 15000);

}
