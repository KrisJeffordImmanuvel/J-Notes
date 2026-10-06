/* Settings dialog. */
import { $, esc, fmtTime } from '../lib/util.js';
import { icon } from '../lib/icons.js';
import { cryptoOK, KDF_ITER } from '../lib/crypto.js';
import { store, storageEstimate } from '../lib/storage.js';
import { VERSION } from '../data/constants.js';
import { S, vault } from '../data/state.js';
import { scheduleSave, getSnaps } from '../data/persist.js';
import { fsOK, folder, setFolderMd } from '../data/folder.js';
import { importFiles } from '../data/importer.js';
import { modal } from './modal.js';
import { applySettings, renderMain } from './nav.js';
import { canInstall } from './pwa.js';

let settingsTab = 'appearance';
export const setSettingsTab = t => { settingsTab = t; };
const TABS = [['appearance', 'palette', 'Appearance'], ['writing', 'pen', 'Writing'], ['diary', 'book', 'Diary'], ['security', 'shield', 'Security'], ['backup', 'download', 'Backup & export'], ['shortcuts', 'keyboard', 'Shortcuts'], ['about', 'info', 'About']];
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
  const k = el.dataset.set; let v = el.type === 'checkbox' ? el.checked : (el.type === 'range' || el.dataset.num) ? Number(el.value) : el.value;
  S.settings[k] = v; applySettings(); scheduleSave();
  const out = $(`[data-out="${k}"]`); if (out) out.textContent = el.type === 'range' ? (k === 'lh' ? v.toFixed(1) : v + 'px') : '';
  if (['power', 'toolbar', 'mood', 'prompts', 'spell'].includes(k)) renderMain();
  if (k === 'reminder' && v && 'Notification' in window && Notification.permission === 'default') Notification.requestPermission();
  if (k === 'name') renderMain();
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
      <div class="field"><label for="nmIn">Your name</label><input class="input" id="nmIn" data-set="name" value="${esc(st.name)}" placeholder="Used for your greeting and diary book"></div>
      ${sw('power', 'Power mode', 'Unlocks [[note links]], backlinks and templates. Simple mode stays clean.')}
      ${sw('toolbar', 'Formatting toolbar', 'Show the small toolbar above the editor. Markdown shortcuts always work.')}
      ${sw('typewriter', 'Typewriter mode', 'Keep the line you are writing in the middle of the screen.')}
      ${sw('spell', 'Spell check', 'Underline misspelled words while you type.')}
      <div class="note-box">Focus mode hides everything except your page — press <kbd>Alt</kbd> + <kbd>F</kbd> or use the ${icon('focus')} button in the editor.</div>`;
      break;
    case 'diary':
      html = `<h3>Diary</h3>
      ${sw('mood', 'Mood & energy', 'Optional quick mood picker and a monthly mood chart.')}
      ${sw('prompts', 'Writing prompts', 'Show a gentle reflection prompt on empty entries.')}
      <h4>Gentle reminder</h4><p class="muted small" style="margin-top:0">One quiet reminder a day if you haven't written yet. No streaks, no guilt. Works while J Notes is open in a tab.</p>
      <div style="display:flex;gap:8px;align-items:center"><input class="input" type="time" data-set="reminder" value="${esc(st.reminder)}" style="width:auto" aria-label="Reminder time">${st.reminder ? `<button class="btn sm ghost" data-act="clearReminder">Turn off</button>` : ''}</div>
      <h4>Diary book</h4><p class="muted small" style="margin-top:0">Turn a month or a whole year into a printable book.</p><button class="btn sm" data-act="diaryBook">${icon('print')} Create diary book</button>`;
      break;
    case 'security':
      html = `<h3>Security & privacy</h3>` + (!cryptoOK ? `<div class="note-box">Encryption needs a secure browser context. Open this file directly in Chrome, Edge, Firefox or Safari.</div>` :
        vault.enc ? `<div class="note-box" style="display:flex;gap:10px;align-items:flex-start">${icon('shield', 'ok')}<span><b style="color:var(--text)">App lock is on.</b> Your notes are encrypted with AES-256-GCM. The key is derived from your PIN with PBKDF2 (${KDF_ITER.toLocaleString()} rounds) and never stored.</span></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0"><button class="btn sm" data-act="lockSetup">Change PIN</button><button class="btn sm" data-act="newRecovery">New recovery key</button><button class="btn sm" data-act="lock">${icon('lock')} Lock now</button><button class="btn sm danger" data-act="lockOff">Turn off app lock</button></div>
        <h4>Auto-lock</h4><select class="input" data-set="autolock" data-num="1" style="width:auto" aria-label="Auto-lock">${[[1, 'After 1 minute'], [5, 'After 5 minutes'], [15, 'After 15 minutes'], [30, 'After 30 minutes'], [0, 'Never']].map(([v, l]) => `<option value="${v}"${st.autolock === v ? ' selected' : ''}>${l}</option>`).join('')}</select>`
          : `<div class="note-box" style="display:flex;gap:10px;align-items:flex-start">${icon('alert', 'warnc')}<span><b style="color:var(--text)">App lock is off.</b> Notes are stored in this browser in readable form. Set a PIN to encrypt everything on this device.</span></div><button class="btn primary" data-act="lockSetup" style="margin-top:8px">${icon('lock')} Set up app lock</button>`) +
        `<h4>Private entries</h4><p class="muted small" style="margin-top:0">Any note or diary entry can have its own extra password. Open the entry, then choose ${icon('more')} → Make private.</p>
        <h4>What J Notes never does</h4><ul class="muted small" style="margin-top:0;padding-left:18px"><li>No accounts, analytics, ads or trackers.</li><li>Your words never leave this device unless you export them. The only network traffic is the app downloading its own updates.</li><li>No lock-in: everything exports as plain Markdown.</li></ul>`;
      break;
    case 'backup': {
      const snaps = getSnaps().slice().reverse();
      html = `<h3>Backup & export</h3>
      <h4>Export</h4><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm" data-act="exportZip">${icon('download')} All notes as Markdown (.zip)</button><button class="btn sm" data-act="exportJson">${icon('download')} Full backup (.json)</button>${vault.enc ? `<button class="btn sm" data-act="exportEnc">${icon('lock')} Encrypted backup</button>` : ''}<button class="btn sm" data-act="diaryBook">${icon('print')} Diary book (PDF)</button></div>
      <h4>Import</h4><p class="muted small" style="margin-top:0">Markdown or text files (from Obsidian, Joplin, Notion, Bear, Day One exports…) or a J Notes backup. Backups are merged — nothing is overwritten with older versions.</p>
      <label class="btn sm">${icon('upload')} Choose files<input type="file" id="impFiles" multiple accept=".md,.markdown,.txt,.json" hidden></label>
      <h4>Sync to your own folder</h4>
      ${fsOK ? `<p class="muted small" style="margin-top:0">Pick a folder inside iCloud Drive, Google Drive, Dropbox, OneDrive or Syncthing. J Notes writes ${vault.enc ? 'an <b>encrypted</b> vault file' : 'a vault file and readable Markdown copies'} there after every change, so it travels to your other devices. Use “Merge from folder” on another device to bring changes in.</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">${folder.pending ? `<button class="btn sm primary" data-act="reconnectFolder">${icon('folderSync')} Reconnect “${esc(folder.pending.name)}”</button>` : ''}<button class="btn sm" data-act="chooseFolder">${icon('folderSync')} ${folder.handle || folder.pending ? 'Change folder' : 'Choose folder'}</button>${folder.handle ? `<button class="btn sm" data-act="mergeFolder">Merge from folder</button><span class="badge">${icon('check1')} ${esc(folder.handle.name)}</span>` : ''}${folder.handle || folder.pending ? `<button class="btn sm ghost" data-act="forgetFolder">Stop syncing</button>` : ''}</div>
        ${!vault.enc ? `<label class="switch-row" style="border:0"><span class="txt"><b>Also write Markdown files</b><span>Readable .md copies of every note, organised by notebook.</span></span><input type="checkbox" class="toggle" id="fMd" ${folder.md ? 'checked' : ''}></label>` : ''}
        <p class="muted small">J Notes remembers the folder. After a browser restart, click “Reconnect” once to allow access again.</p>`
          : `<div class="note-box">Folder sync needs Chrome, Edge or another Chromium browser on a computer. In this browser, use the exports above and keep them in your cloud drive.</div>`}
      <h4>Automatic snapshots</h4><p class="muted small" style="margin-top:0">J Notes keeps a snapshot of all your data each day for the last 7 days${vault.enc ? ' (encrypted)' : ''}.</p>
      ${snaps.length ? `<div>${snaps.map((s, i) => `<div class="snap-row">${icon('restore')}<span style="flex:1">${fmtTime(s.t)}${s.manual ? ' · manual' : ''} <span class="muted small">${(s.size / 1024).toFixed(1)} KB</span></span><button class="btn sm" data-act="restoreSnap" data-i="${snaps.length - 1 - i}">Restore</button></div>`).join('')}</div>` : '<p class="muted small">No snapshots yet.</p>'}
      <button class="btn sm" data-act="snapNow" style="margin-top:10px">Take snapshot now</button>
      <h4>Storage on this device</h4><p class="muted small" style="margin-top:0" id="storageInfo">${storeLabel()}</p>
      <h4 style="color:var(--danger)">Danger zone</h4><button class="btn sm danger" data-act="eraseAll">Erase all data on this device</button>`;
      break;
    }
    case 'shortcuts': {
      const rows = [['Search everything', 'Ctrl / ⌘ + K'], ['New note', 'Alt + N'], ['Today’s diary entry', 'Alt + D'], ['Home', 'Alt + H'], ['Read / edit mode', 'Ctrl / ⌘ + E'], ['Focus mode', 'Alt + F'], ['Lock now', 'Alt + L'], ['Save now', 'Ctrl / ⌘ + S'], ['Bold / Italic', 'Ctrl / ⌘ + B / I'], ['Continue a list', 'Enter'], ['Close dialog or focus mode', 'Esc']];
      html = `<h3>Keyboard shortcuts</h3><div>${rows.map(([a, b]) => `<div class="switch-row"><span class="txt">${a}</span><kbd>${b}</kbd></div>`).join('')}</div>
      <h4>Markdown you can type</h4><p class="muted small" style="margin-top:0"><code># Heading</code> · <code>**bold**</code> · <code>*italic*</code> · <code>==highlight==</code> · <code>- list</code> · <code>- [ ] task</code> · <code>&gt; quote</code> · <code>\`code\`</code> · <code>[text](url)</code>${st.power ? ' · <code>[[Note title]]</code>' : ''}</p>`;
      break;
    }
    case 'about':
      html = `<h3>About J Notes</h3><p><b>Private by design. Yours forever. Simple to use.</b></p>
      <p class="muted">J Notes ${VERSION} works fully offline, stores notes as plain Markdown, and never sends your words anywhere.</p>
      ${canInstall() ? `<p><button class="btn sm primary" data-act="installApp">${icon('download')} Install J Notes as an app</button></p>` : ''}
      <h4>Seven promises</h4><ol class="muted small" style="padding-left:18px;line-height:1.8">
      <li><b>Local-first</b> — works completely on your device.</li><li><b>You own your data</b> — standard Markdown, export anytime.</li><li><b>Private by default</b> — optional AES-256 encryption, no tracking.</li><li><b>Never lose a word</b> — version history, 30-day trash, daily snapshots.</li><li><b>Simple first</b> — power features only when you want them.</li><li><b>Calm and focused</b> — no feeds, no streaks, no noise.</li><li><b>Honest</b> — free, with nothing held hostage.</li></ol>
      <div class="note-box">Your notes live in this browser's storage for this site. Clearing site data or using a private window removes them — keep a backup or set up folder sync.</div>`;
  }
  box.innerHTML = `<nav aria-label="Settings sections">${TABS.map(([k, i, l]) => `<button class="${k === settingsTab ? 'on' : ''}" data-act="settingsTab" data-tab="${k}">${icon(i)} ${l}</button>`).join('')}</nav><section>${html}</section>`;
  const imp = $('#impFiles'); if (imp) imp.onchange = async () => { await importFiles([...imp.files]); renderSettingsIfOpen(); };
  const fmd = $('#fMd'); if (fmd) fmd.onchange = () => setFolderMd(fmd.checked);
  const si = $('#storageInfo');
  if (si) storageEstimate().then(est => { if (est && est.usage != null && $('#storageInfo') === si) si.textContent = `${storeLabel()} · ${mb(est.usage)} used${est.quota ? ` of about ${mb(est.quota)} available` : ''}.`; });
}

const mb = b => b >= 1e9 ? (b / 1e9).toFixed(1) + ' GB' : (b / 1e6).toFixed(1) + ' MB';
function storeLabel() {
  return { indexeddb: 'Saved in the browser database (IndexedDB)', localstorage: 'Saved in browser localStorage (limited to about 5 MB — keep backups)', memory: 'Not saved: this browser is blocking storage' }[store.mode];
}
