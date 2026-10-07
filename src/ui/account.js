/* Google account & sync UI: sign-in button, status, settings section and actions. */
import { $, $$, esc, rel } from '../lib/util.js';
import { icon } from '../lib/icons.js';
import { googleAvailable, loadGoogle } from '../lib/google.js';
import { S, UI, cur, diaryFor } from '../data/state.js';
import { sync, isSignedIn, connectGoogle, reconnectGoogle, signOutGoogle, deleteCloudCopy, unlockCloudCopy, syncNow, setSyncHooks } from '../data/sync.js';
import { toast } from './toast.js';
import { confirmModal, promptModal, closeModal } from './modal.js';
import { renderSidebar } from './sidebar.js';
import { renderList } from './notes.js';
import { renderHome } from './home.js';
import { renderDiarySide } from './diary.js';
import { renderEditor } from './editor.js';
import { renderSettingsIfOpen, openSettings, settingsTabOpen } from './settings.js';

const G_LOGO = '<svg class="g-logo" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>';

/** Google-styled "Continue with Google" button (signs in, or creates the sync space on first use). */
export const googleButton = (extra = '') => `<button class="gbtn" data-act="googleConnect" ${extra}>${G_LOGO}<span>Continue with Google</span></button>`;

export function syncLabel() {
  switch (sync.state) {
    case 'idle': return sync.lastSync ? `Synced ${rel(sync.lastSync)}` : 'Synced';
    case 'syncing': return 'Syncing…';
    case 'paused': return 'Sync paused — reconnect';
    case 'needs-pin': return 'Enter your PIN to sync';
    case 'offline': return 'Offline — will sync when back online';
    case 'error': return 'Sync problem — will retry';
    default: return 'Not syncing';
  }
}
const syncIcon = () => ({ idle: 'cloud', syncing: 'restore', offline: 'cloud', error: 'alert', paused: 'alert', 'needs-pin': 'lock' }[sync.state] || 'cloud');
const needsAction = () => ['paused', 'needs-pin', 'error'].includes(sync.state);

/** Small button for the sidebar footer (only while signed in). */
export function sidebarSyncButton() {
  if (!googleAvailable() || !isSignedIn()) return '';
  const label = syncLabel();
  return `<button class="icon-btn js-sync${needsAction() ? ' warn' : ''}${sync.state === 'syncing' ? ' spin' : ''}" data-act="syncClick" title="${esc(label)}" aria-label="${esc(label)}">${icon(syncIcon())}</button>`;
}

/** One line for the Home "Your data" card. */
export function homeSyncLine() {
  if (!googleAvailable()) return '';
  if (!isSignedIn()) return `<li class="js-home-sync">${icon('cloud', 'warnc')}<span>Not synced — <button class="linkish" data-act="settings" data-tab="account">sync across your devices with Google</button></span></li>`;
  const ok = sync.state === 'idle';
  return `<li class="js-home-sync">${icon(ok ? 'check1' : 'alert', ok ? 'ok' : 'warnc')}<span>${esc(syncLabel())} · ${esc(sync.account.email)}${needsAction() ? ` — <button class="linkish" data-act="syncClick">fix</button>` : ''}</span></li>`;
}

/** Settings → Account & sync. */
export function accountSettingsHTML() {
  if (!isSignedIn()) {
    return `<h3>Account & sync</h3>
      <p style="margin-top:0">Sign in with Google to keep your notes and diary in sync on all your devices — your laptop, phone and tablet.</p>
      ${googleButton()}
      <p class="muted small">Sign in or sign up: the first time, J Notes creates its own private folder in your Google Drive. On your other devices, open J Notes and press the same button.</p>
      <h4>How it works</h4><ul class="muted small" style="margin-top:0;padding-left:18px;line-height:1.7">
        <li>Your notes are stored in a hidden J Notes folder in <b>your own</b> Google Drive. There is no J Notes server.</li>
        <li>J Notes can only see its own folder — not your other Drive files.</li>
        <li>With the app lock on, notes are encrypted on this device before they are uploaded.</li>
        <li>J Notes keeps working offline and without an account; signing in is optional.</li></ul>`;
  }
  const a = sync.account;
  return `<h3>Account & sync</h3>
    <div class="acct">${a.picture ? `<img src="${esc(a.picture)}" alt="" referrerpolicy="no-referrer">` : `<div class="logo">${esc((a.name || '?')[0])}</div>`}
      <div><b>${esc(a.name)}</b><div class="muted small">${esc(a.email)}</div></div></div>
    <div class="note-box" style="display:flex;gap:10px;align-items:center">${icon(syncIcon(), needsAction() ? 'warnc' : 'ok')}<span style="flex:1"><b style="color:var(--text)">${esc(syncLabel())}</b>${sync.state === 'error' && sync.message ? `<br><span class="small">${esc(sync.message)}</span>` : ''}</span>
      ${sync.state === 'paused' ? `<button class="btn sm primary" data-act="googleReconnect">Reconnect</button>` : sync.state === 'needs-pin' ? `<button class="btn sm primary" data-act="unlockCloud">Enter PIN</button>` : `<button class="btn sm" data-act="syncNow"${sync.state === 'syncing' ? ' disabled' : ''}>Sync now</button>`}</div>
    <p class="muted small">Changes sync a few seconds after you write, when you come back to the app, and every couple of minutes. Google keeps you connected for about an hour at a time — after that, press <b>Reconnect</b> once.</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button class="btn sm" data-act="googleSignOut">Sign out</button><button class="btn sm danger" data-act="googleDelete">Delete my notes from Google Drive</button></div>
    <p class="muted small">Signing out keeps your notes on this device and in your Drive. You can sign in again any time.</p>`;
}

/* ---------- actions ---------- */
async function guarded(fn, okMsg) {
  try { await fn(); if (okMsg) toast(okMsg); }
  catch (e) { if (e && e.message) toast(e.message); }
  renderSidebar(); renderSettingsIfOpen();
}
export const accountActions = {
  googleConnect: d => guarded(async () => {
    if (d && d.onboard) {   // pressed in the welcome dialog: keep the name and finish onboarding
      const nm = $('#obName'); if (nm && S) S.settings.name = nm.value.trim();
      closeModal();
    }
    await connectGoogle();
  }, null).then(() => {
    if (isSignedIn()) toast(sync.state === 'needs-pin' ? 'Signed in. Enter the PIN from your other device to open your synced notes.' : `Signed in as ${sync.account.email} — your notes will now sync.`);
  }),
  googleReconnect: () => guarded(reconnectGoogle),
  syncNow: () => guarded(syncNow),
  syncClick: () => {
    if (sync.state === 'paused') return accountActions.googleReconnect();
    if (sync.state === 'needs-pin') return accountActions.unlockCloud();
    openSettings('account');
  },
  unlockCloud: async () => {
    const secret = await promptModal({ title: 'Open your synced notes', label: 'Your synced notes are locked with the app lock PIN from another device. Enter that PIN (or its 24-word recovery key).', type: 'password', ok: 'Unlock' });
    if (!secret) return;
    try { await unlockCloudCopy(secret); toast('Unlocked — your notes are syncing.'); }
    catch (e) { toast('That PIN or recovery key is not right.'); }
    renderSidebar(); renderSettingsIfOpen();
  },
  googleSignOut: async () => {
    if (!await confirmModal({ title: 'Sign out of Google?', text: 'Syncing stops on this device. Your notes stay here and in your Google Drive.', ok: 'Sign out' })) return;
    await guarded(signOutGoogle, 'Signed out — notes stay on this device.');
    openSettings('account');
  },
  googleDelete: async () => {
    if (!await confirmModal({ title: 'Delete notes from Google Drive?', text: 'This removes the J Notes copy from your Google Drive and signs you out. Notes on this device are kept. Your other devices will upload their copy again if they are still signed in.', ok: 'Delete from Drive', danger: true })) return;
    await guarded(deleteCloudCopy, 'Deleted from Google Drive and signed out.');
    openSettings('account');
  }
};

/** Preload Google's script when a sign-in button is about to be pressed (keeps the popup within the click). */
function warmUp(e) { if (e.target.closest && e.target.closest('[data-act=googleConnect],[data-act=googleReconnect],[data-act=syncClick]')) loadGoogle().catch(() => { }); }

export function installAccountUI() {
  if (!googleAvailable()) return;
  ['pointerover', 'focusin', 'touchstart'].forEach(ev => document.addEventListener(ev, warmUp, { passive: true }));
  setSyncHooks({
    onChange: () => {
      $$('.js-sync').forEach(el => { el.outerHTML = sidebarSyncButton(); });
      $$('.js-home-sync').forEach(el => { el.outerHTML = homeSyncLine(); });
      if (settingsTabOpen('account')) renderSettingsIfOpen();   // don't disturb other settings tabs
    },
    notify: msg => toast(msg, null, 7000),
    onRemoteData: changed => {
      if (!S) return;
      if (UI.current && !S.notes.some(n => n.id === UI.current)) UI.current = null;
      if (UI.view === 'diary' && !UI.current) { const e = diaryFor(UI.diaryDate); if (e) UI.current = e.id; }
      renderSidebar();
      if (UI.view === 'home') {
        const q = $('#quickText'), draft = q ? q.value : '';   // keep a half-written quick note
        renderHome($('#main'));
        if (draft) $('#quickText').value = draft;
      }
      else {
        renderList();
        if (UI.view === 'diary') renderDiarySide();
        if (!cur() || changed.has(UI.current)) renderEditor();
      }
    }
  });
}
