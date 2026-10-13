/* Settings dialog. */
import { $, esc, fmtTime } from '../lib/util.js';
import { icon } from '../lib/icons.js';
import { cryptoOK, KDF_ITER } from '../lib/crypto.js';
import { store, storageEstimate } from '../lib/storage.js';
import { VERSION } from '../data/constants.js';
import { S, vault, note } from '../data/state.js';
import { scheduleSave, getSnaps, snapshotNow } from '../data/persist.js';
import { readBackup } from '../data/backup.js';
import { modal, confirmModal } from './modal.js';
import { toast } from './toast.js';
import { applySettings, render } from './view.js';
import { canInstall } from './pwa.js';

let settingsTab = 'appearance';
export const setSettingsTab = t => { settingsTab = t; };
const TABS = [['appearance', 'palette', 'Appearance'], ['writing', 'pen', 'Writing'], ['security', 'shield', 'Security'], ['backup', 'download', 'Backup'], ['shortcuts', 'keyboard', 'Shortcuts'], ['about', 'info', 'About']];

export function openSettings(tab) {
  if (tab) settingsTab = tab;
  modal({ title: 'Settings', wide: true, body: `<div class="settings" id="settingsBox"></div>` });
  const box = $('#settingsBox');
  box.addEventListener('change', settingsChange); box.addEventListener('input', e => { if (e.target.type === 'range') settingsChange(e); });
  renderSettings();
}
export function renderSettingsIfOpen() { if ($('#settingsBox')) renderSettings(); }

function settingsChange(e) {
  const el = e.target.closest('[data-set]'); if (!el) return;
  const k = el.dataset.set; const v = el.type === 'checkbox' ? el.checked : (el.type === 'range' || el.dataset.num) ? Number(el.value) : el.value;
  S.settings[k] = v; applySettings(); scheduleSave();
  const out = $(`[data-out="${k}"]`); if (out) out.textContent = el.type === 'range' ? (k === 'lh' ? v.toFixed(1) : v + 'px') : '';
  if (['toolbar', 'spell'].includes(k)) render();
}
const sw = (k, title, desc) => `<label class="switch-row"><span class="txt"><b>${title}</b><span>${desc}</span></span><input type="checkbox" class="toggle" data-set="${k}" ${S.settings[k] ? 'checked' : ''}></label>`;

export function renderSettings() {
  const box = $('#settingsBox'); if (!box) return; const st = S.settings;
  let html = '';
  switch (settingsTab) {
    case 'appearance': {
      const themes = [['auto', 'Automatic', '#f5f4ef', '#14181b', '#2f6b5e'], ['light', 'Light', '#f5f4ef', '#ffffff', '#2f6b5e'], ['dark', 'Dark', '#14181b', '#1e2428', '#6db3a1'], ['night', 'Warm night', '#1b1611', '#251e17', '#d6a46e'], ['contrast', 'High contrast', '#000', '#000', '#ffd60a']];
      html = `<h3>Appearance</h3><div class="flabel">Theme</div><div class="theme-tiles">${themes.map(([k, l, a, b, c]) => `<button class="theme-tile${st.theme === k ? ' on' : ''}" data-act="setOpt" data-k="theme" data-v="${k}"><div class="sw" style="background:linear-gradient(135deg,${a} 50%,${b} 50%);border:1px solid var(--line)"><i style="width:40%;background:${c}"></i><i style="width:25%;background:${c};opacity:.5"></i></div><span>${l}</span></button>`).join('')}</div>
      <h4>Writing font</h4><div class="seg">${[['sans', 'Sans'], ['serif', 'Serif'], ['mono', 'Mono']].map(([k, l]) => `<button class="${st.font === k ? 'on' : ''}" data-act="setOpt" data-k="font" data-v="${k}">${l}</button>`).join('')}</div>
      <h4>Text size <span class="muted" data-out="size">${st.size}px</span></h4><input type="range" min="14" max="24" step="1" value="${st.size}" data-set="size" style="width:100%;accent-color:var(--accent)" aria-label="Text size">
      <h4>Line spacing <span class="muted" data-out="lh">${(+st.lh).toFixed(1)}</span></h4><input type="range" min="1.3" max="2.2" step="0.1" value="${st.lh}" data-set="lh" style="width:100%;accent-color:var(--accent)" aria-label="Line spacing">
      <h4>Page width <span class="muted" data-out="width">${st.width}px</span></h4><input type="range" min="520" max="1100" step="20" value="${st.width}" data-set="width" style="width:100%;accent-color:var(--accent)" aria-label="Page width">`;
      break;
    }
    case 'writing':
      html = `<h3>Writing</h3>
      ${sw('toolbar', 'Formatting toolbar', 'Show the small toolbar above the note. Markdown shortcuts always work.')}
      ${sw('typewriter', 'Typewriter mode', 'Keep the line you are writing in the middle of the screen.')}
      ${sw('spell', 'Spell check', 'Underline misspelled words while you type.')}
      <div class="note-box">Focus mode hides everything except your page — press <kbd>Alt</kbd> + <kbd>F</kbd> or use the ${icon('focus')} button.</div>`;
      break;
    case 'security':
      html = `<h3>Security</h3>` + (!cryptoOK ? `<div class="note-box">Encryption needs a secure browser context. Open J Notes from its web address in Chrome, Edge, Firefox or Safari.</div>` :
        vault.enc ? `<div class="note-box" style="display:flex;gap:10px;align-items:flex-start">${icon('shield', 'ok')}<span><b style="color:var(--text)">Your note is locked with your PIN.</b> It's encrypted with AES-256-GCM; the key comes from your PIN through PBKDF2 (${KDF_ITER.toLocaleString()} rounds) and is never stored.</span></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0"><button class="btn sm" data-act="lockSetup">Change PIN</button><button class="btn sm" data-act="newRecovery">New recovery key</button><button class="btn sm" data-act="lock">${icon('lock')} Lock now</button></div>
        <h4>Auto-lock</h4><select class="input" data-set="autolock" data-num="1" style="width:auto" aria-label="Auto-lock">${[[1, 'After 1 minute'], [5, 'After 5 minutes'], [15, 'After 15 minutes'], [30, 'After 30 minutes'], [0, 'Never']].map(([v, l]) => `<option value="${v}"${st.autolock === v ? ' selected' : ''}>${l}</option>`).join('')}</select>`
          : `<div class="note-box">Set a PIN to encrypt your note.</div><button class="btn primary" data-act="lockSetup" style="margin-top:8px">${icon('lock')} Set PIN</button>`) +
        `<h4>Private by design</h4><ul class="muted small" style="margin-top:0;padding-left:18px"><li>No account, analytics, ads or trackers.</li><li>Your note never leaves this device unless you download or back it up.</li></ul>`;
      break;
    case 'backup': {
      const snaps = getSnaps().slice().reverse();
      html = `<h3>Backup</h3>
      <h4>Download</h4><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm" data-act="downloadMd">${icon('download')} Note as Markdown (.md)</button><button class="btn sm" data-act="printNote">${icon('print')} Print / Save as PDF</button></div>
      <h4>Backup file</h4><p class="muted small" style="margin-top:0">Keep a copy somewhere safe, e.g. your cloud drive. The encrypted backup needs your PIN to open.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap">${vault.enc ? `<button class="btn sm" data-act="exportEnc">${icon('lock')} Encrypted backup (.json)</button>` : ''}<button class="btn sm" data-act="exportJson">${icon('download')} Readable backup (.json)</button></div>
      <h4>Restore from a backup file</h4><p class="muted small" style="margin-top:0">Replaces the note with the one in the backup. Backups from older versions with several notes are combined into one. A snapshot of the current note is taken first.</p>
      <label class="btn sm">${icon('upload')} Choose backup file<input type="file" id="restoreFile" accept=".json,application/json" hidden></label>
      <h4>Automatic snapshots</h4><p class="muted small" style="margin-top:0">A snapshot of your note is kept for each of the last 7 days${vault.enc ? ' (encrypted)' : ''}.</p>
      ${snaps.length ? `<div>${snaps.map((s, i) => `<div class="snap-row">${icon('restore')}<span style="flex:1">${esc(fmtTime(s.t))}${s.label ? ` · <b>${esc(s.label)}</b>` : s.manual ? ' · manual' : ''} <span class="muted small">${(s.size / 1024).toFixed(1)} KB</span></span><button class="btn sm" data-act="restoreSnap" data-i="${snaps.length - 1 - i}">Restore</button></div>`).join('')}</div>` : '<p class="muted small">No snapshots yet.</p>'}
      <button class="btn sm" data-act="snapNow" style="margin-top:10px">Take snapshot now</button>
      <h4>Storage</h4><p class="muted small" style="margin-top:0" id="storageInfo">${storeLabel()}</p>
      <h4 style="color:var(--danger)">Danger zone</h4><button class="btn sm danger" data-act="eraseAll">Erase everything on this device</button>`;
      break;
    }
    case 'shortcuts': {
      const rows = [['Find in note', 'Ctrl / ⌘ + F'], ['Read / edit mode', 'Ctrl / ⌘ + E'], ['Focus mode', 'Alt + F'], ['Lock now', 'Alt + L'], ['Save now', 'Ctrl / ⌘ + S'], ['Bold / Italic', 'Ctrl / ⌘ + B / I'], ['Continue a list', 'Enter'], ['Close dialog, find or focus mode', 'Esc']];
      html = `<h3>Keyboard shortcuts</h3><div>${rows.map(([a, b]) => `<div class="switch-row"><span class="txt">${a}</span><kbd>${b}</kbd></div>`).join('')}</div>
      <h4>Markdown you can type</h4><p class="muted small" style="margin-top:0"><code># Heading</code> · <code>**bold**</code> · <code>*italic*</code> · <code>==highlight==</code> · <code>- list</code> · <code>- [ ] task</code> · <code>&gt; quote</code> · <code>\`code\`</code> · <code>[text](url)</code></p>`;
      break;
    }
    case 'about':
      html = `<h3>About J Notes</h3><p><b>One private note, always with you.</b></p>
      <p class="muted">J Notes ${VERSION}. Works offline, keeps your note as plain Markdown, and never sends it anywhere.</p>
      ${canInstall() ? `<p><button class="btn sm primary" data-act="installApp">${icon('download')} Install J Notes as an app</button></p>` : ''}
      <ul class="muted small" style="padding-left:18px;line-height:1.8"><li>Version history while you write, plus a daily snapshot.</li><li>Download or back up the note any time from Backup.</li></ul>
      <div class="note-box">The note lives in this browser on this device. Clearing site data removes it — keep a backup file.</div>`;
  }
  box.innerHTML = `<nav aria-label="Settings sections">${TABS.map(([k, i, l]) => `<button class="${k === settingsTab ? 'on' : ''}" data-act="settingsTab" data-tab="${k}">${icon(i)} ${l}</button>`).join('')}</nav><section>${html}</section>`;
  const rf = $('#restoreFile'); if (rf) rf.onchange = () => { const f = rf.files[0]; rf.value = ''; if (f) restoreFromFile(f); };
  const si = $('#storageInfo');
  if (si) storageEstimate().then(est => { if (est && est.usage != null && $('#storageInfo') === si) si.textContent = `${storeLabel()} · ${mb(est.usage)} used.`; });
}

async function restoreFromFile(file) {
  let data;
  try { data = await readBackup(await file.text()); } catch (e) { toast(e.message); return; }
  if (!data) return;
  const words = data.notes[0].body.split(/\s+/).filter(Boolean).length;
  if (!await confirmModal({ title: 'Restore this backup?', text: `Your note will be replaced with the backup (${words.toLocaleString()} words). A snapshot of the current note is taken first, so you can go back.`, ok: 'Restore' })) return;
  await snapshotNow();
  S.notes = data.notes; S.attachments = data.attachments || {};
  note().updated = Date.now();
  scheduleSave(); render(); toast('Backup restored.');
}

const mb = b => b >= 1e9 ? (b / 1e9).toFixed(1) + ' GB' : (b / 1e6).toFixed(1) + ' MB';
function storeLabel() {
  return { indexeddb: 'Saved in the browser database (IndexedDB)', localstorage: 'Saved in browser localStorage (limited to about 5 MB — keep backups)', memory: 'Not saved: this browser is blocking storage' }[store.mode];
}
