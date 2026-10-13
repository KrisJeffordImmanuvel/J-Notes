/* Click/keyboard actions (event delegation), global shortcuts and timers. */
import { esc, fmtTime } from '../lib/util.js';
import { store, KEY, SNAP, THEMEKEY, prefs } from '../lib/storage.js';
import { S, UI, vault } from '../data/state.js';
import { scheduleSave, persist, saveState, getSnaps, snapshotNow, flags } from '../data/persist.js';
import { newRecovery } from '../data/vault.js';
import { downloadMarkdown, exportBackup } from '../data/backup.js';
import { dismissModal, promptModal, confirmModal, closeMenu, isModalOpen, isMenuOpen, isStickyModal } from './modal.js';
import { toast } from './toast.js';
import { applySettings, togglePreview, toggleFocus } from './view.js';
import { fmt } from './format.js';
import { openFind, closeFind, step as findStep, isFindOpen } from './find.js';
import { openHistory } from './history.js';
import { printNote } from './print.js';
import { lockApp, setupLock, showRecovery } from './lock.js';
import { openSettings, renderSettings, setSettingsTab } from './settings.js';
import { installApp } from './pwa.js';

const H = {
  closeModal: () => dismissModal(),
  settings: d => openSettings(d.tab),
  settingsTab: d => { setSettingsTab(d.tab); renderSettings(); },
  setOpt: d => { S.settings[d.k] = d.v; applySettings(); scheduleSave(); renderSettings(); },
  lock: () => lockApp(),
  lockSetup: () => setupLock(),
  newRecovery: async () => { if (await confirmModal({ title: 'Create a new recovery key?', text: 'Your old recovery key will stop working.', ok: 'Create new key' })) showRecovery(await newRecovery()); },
  togglePreview: () => togglePreview(),
  toggleFocus: () => toggleFocus(),
  history: () => openHistory(),
  fmt: d => fmt(d.f),
  find: () => (isFindOpen() ? closeFind() : openFind()),
  findNext: () => findStep(1),
  findPrev: () => findStep(-1),
  findClose: () => closeFind(),
  downloadMd: () => downloadMarkdown(),
  printNote: () => printNote(),
  exportJson: () => exportBackup(false),
  exportEnc: () => exportBackup(true),
  installApp: () => installApp(),
  snapNow: async () => { await snapshotNow(); renderSettings(); toast('Snapshot saved'); },
  restoreSnap: async d => {
    const s = getSnaps()[+d.i]; if (!s) return;
    if (!await confirmModal({ title: 'Restore snapshot?', text: `Replace your note with the snapshot from ${esc(fmtTime(s.t))}? A snapshot of the current note is taken first.${s.rec.includes('"enc":true') ? ' You will need the PIN that was in use then.' : ''}`, ok: 'Restore' })) return;
    await snapshotNow();
    flags.noSave = true;
    if (!await store.set(KEY, s.rec)) { flags.noSave = false; toast('Could not restore that snapshot.'); return; }
    location.reload();
  },
  eraseAll: async () => {
    const v = await promptModal({ title: 'Erase everything', label: 'Type ERASE to permanently delete your note, its history and all snapshots on this device.', ok: 'Erase everything' });
    if (v !== 'ERASE') { if (v !== null) toast('Nothing was erased.'); return; }
    flags.noSave = true;
    await Promise.all([store.del(KEY), store.del(SNAP)]); prefs.del(THEMEKEY);
    location.reload();
  }
};

let lastActivity = Date.now();

/** Wire up delegated clicks, shortcuts, saving triggers and timers. Call once. */
export function installGlobalHandlers() {
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]'); if (!el || !S && el.dataset.act !== 'closeModal') return;
    const a = el.dataset.act; if (!H[a]) return;
    e.preventDefault(); e.stopPropagation(); H[a](el.dataset, el, e);
  });
  document.addEventListener('keydown', e => {
    lastActivity = Date.now();
    if (!S) return;
    const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (e.key === 'Escape') {
      if (isMenuOpen()) closeMenu(); else if (isModalOpen()) dismissModal(); else if (isFindOpen()) closeFind(); else if (UI.focus) toggleFocus();
      return;
    }
    if (isModalOpen()) return;
    if (mod && !e.altKey && k === 'f') { e.preventDefault(); openFind(); }
    else if (mod && !e.altKey && k === 'g') { e.preventDefault(); if (isFindOpen()) findStep(e.shiftKey ? -1 : 1); }
    else if (mod && !e.altKey && k === 's') { e.preventDefault(); persist().then(() => toast('Saved')); }
    else if (mod && !e.altKey && k === 'e') { e.preventDefault(); togglePreview(); }
    else if (e.altKey && !mod) {
      if (e.code === 'KeyF') { e.preventDefault(); toggleFocus(); }
      else if (e.code === 'KeyL' && vault.enc) { e.preventDefault(); lockApp(); }
    }
  });
  ['mousemove', 'mousedown', 'touchstart', 'scroll'].forEach(ev => document.addEventListener(ev, () => { lastActivity = Date.now(); }, { passive: true, capture: true }));
  // Save as soon as the page is hidden (tab switch, app switch, closing) — the most reliable moment.
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && S && !flags.noSave) persist(); });
  window.addEventListener('pagehide', () => { if (S && !flags.noSave && saveState === 'saving') persist(); });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (S && S.settings.theme === 'auto') applySettings(); });

  // auto-lock after inactivity
  setInterval(() => {
    if (S && vault.enc && S.settings.autolock > 0 && Date.now() - lastActivity > S.settings.autolock * 60000 && !isStickyModal()) lockApp();
  }, 15000);
}
