/* App lock: PIN setup, recovery key, lock screen and locking. */
import { $, esc, fmtTime } from '../lib/util.js';
import { icon } from '../lib/icons.js';
import { cryptoOK, normWords } from '../lib/crypto.js';
import { store, KEY } from '../lib/storage.js';
import { vault, setS, setVault, migrate, UI } from '../data/state.js';
import { persist } from '../data/persist.js';
import { enableLock, changePin, openRecord, wipeKeys } from '../data/vault.js';
import { modal, closeModal, closeMenu, clearModalOnClose } from './modal.js';
import { toast } from './toast.js';
import { render } from './nav.js';
import { printHTML } from './print.js';
import { renderSettingsIfOpen } from './settings.js';
import { start } from '../app.js';

export async function lockApp() {
  if (!vault.enc) return;
  closeModal(); closeMenu();
  await persist();
  setS(null); wipeKeys(); UI.focus = false; $('#app').classList.remove('focus', 'nav-open');
  $('#main').innerHTML = ''; $('#sidebar').innerHTML = '';
  showLock();
}

export function setupLock(after) {
  if (!cryptoOK) { toast('Encryption is not available in this browser.'); return; }
  modal({
    title: vault.enc ? 'Change PIN' : 'Set up app lock',
    body: `<p class="muted" style="margin-top:0">${vault.enc ? 'Choose a new PIN. Your recovery key stays the same.' : 'Your PIN encrypts every note on this device with AES-256. Without it, nobody can read your notes — not even with access to this browser.'}</p>
    <form id="lkForm"><div class="field"><label for="lk1">${vault.enc ? 'New PIN or passcode' : 'PIN or passcode'}</label><input class="input" type="password" id="lk1" inputmode="text" autocomplete="new-password" autofocus><div class="help">At least 4 characters. Longer is stronger.</div></div>
    <div class="field"><label for="lk2">Repeat it</label><input class="input" type="password" id="lk2" autocomplete="new-password"></div><div class="err-text" id="lkErr"></div></form>`,
    foot: `<button class="btn" data-act="closeModal">Cancel</button><button class="btn primary" id="lkOk">${vault.enc ? 'Change PIN' : 'Continue'}</button>`
  });
  const go = async e => {
    e && e.preventDefault(); const a = $('#lk1').value, b = $('#lk2').value;
    if (a.length < 4) { $('#lkErr').textContent = 'Use at least 4 characters.'; return; }
    if (a !== b) { $('#lkErr').textContent = 'The two entries do not match.'; return; }
    $('#lkOk').disabled = true; $('#lkOk').textContent = 'Encrypting…';
    if (vault.enc) { await changePin(a); closeModal(); toast('PIN changed'); renderSettingsIfOpen(); return; }
    const words = await enableLock(a);
    render(); showRecovery(words, after);
  };
  $('#lkForm').onsubmit = go; $('#lkOk').onclick = go;
}
export function showRecovery(words, after) {
  modal({
    title: 'Save your recovery key', wide: false,
    body: `<p style="margin-top:0">If you forget your PIN, these 24 words are the <b>only</b> way to unlock your notes. Write them down or print them, and keep them somewhere safe.</p>
      <div class="words">${words.map((w, i) => `<div><b>${i + 1}</b>${w}</div>`).join('')}</div>
      <div class="row" style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm" id="rkPrint">${icon('print')} Print recovery sheet</button><button class="btn sm" id="rkCopy">${icon('copy')} Copy</button></div>`,
    foot: `<button class="btn primary" id="rkNext">I've saved it — check me</button>`,
    onClose: () => { if (!verified) toast('App lock is on. You can create a new recovery key in Settings → Security.'); }
  });
  let verified = false;
  $('#rkPrint').onclick = () => printHTML('J Notes recovery sheet', `<h1>J Notes recovery sheet</h1><p>Created ${esc(fmtTime(Date.now()))}. Keep this page private and safe. Anyone with these words can unlock your notes on this device.</p><ol style="columns:3;font:14pt ui-monospace,monospace;line-height:2">${words.map(w => `<li>${w}</li>`).join('')}</ol>`);
  $('#rkCopy').onclick = () => navigator.clipboard && navigator.clipboard.writeText(words.join(' ')).then(() => toast('Copied — paste it somewhere safe, then clear your clipboard.'));
  $('#rkNext').onclick = () => {
    clearModalOnClose();
    const a = Math.floor(Math.random() * 12), b = 12 + Math.floor(Math.random() * 12);
    const m = modal({
      title: 'Check your recovery key', onClose: () => { if (!verified) toast('App lock is on. Remember to keep your recovery key safe.'); },
      body: `<p class="muted" style="margin-top:0">Type two words from your key to make sure you saved it correctly.</p>
      <div class="field"><label for="rv1">Word #${a + 1}</label><input class="input" id="rv1" autocomplete="off" autofocus></div>
      <div class="field"><label for="rv2">Word #${b + 1}</label><input class="input" id="rv2" autocomplete="off"></div><div class="err-text" id="rvErr"></div>`,
      foot: `<button class="btn" id="rvBack">Show words again</button><button class="btn primary" id="rvOk">Finish</button>`
    });
    $('#rvBack').onclick = () => { clearModalOnClose(); showRecovery(words, after); };
    const fin = () => {
      if ($('#rv1').value.trim().toLowerCase() !== words[a] || $('#rv2').value.trim().toLowerCase() !== words[b]) { $('#rvErr').textContent = 'Those words don’t match. Check your copy and try again.'; return; }
      verified = true; closeModal(); toast('App lock is on — your notes are encrypted'); if (after) after(); else renderSettingsIfOpen();
    };
    $('#rvOk').onclick = fin; m.addEventListener('keydown', e => { if (e.key === 'Enter') fin(); });
  };
}

/* ---------- lock screen ---------- */
let failCount = 0, lockUntil = 0;
export function showLock(mode = 'pin') {
  const L = $('#lockScreen'); L.classList.remove('hidden');
  L.innerHTML = `<div class="lock-card"><div class="logo">J</div><h1>J Notes is locked</h1>
    ${mode === 'pin' ? `<p class="muted">Enter your PIN to unlock your notes.</p>
      <form id="lockForm"><input class="input" id="pinIn" type="password" autocomplete="current-password" aria-label="PIN"><div class="err-text" id="lockErr"></div><button class="btn primary block" type="submit" id="unlockBtn">Unlock</button></form>
      <p><button class="linkish" id="useRec">Forgot your PIN? Use your recovery key</button></p>`
      : `<p class="muted">Type your 24-word recovery key, separated by spaces.</p>
      <form id="lockForm"><textarea class="input" id="recIn" aria-label="Recovery key" spellcheck="false" autocapitalize="off"></textarea><div class="err-text" id="lockErr"></div><button class="btn primary block" type="submit" id="unlockBtn">Recover</button></form>
      <p><button class="linkish" id="useRec">Back to PIN</button></p>`}
    <p class="muted small" style="margin-top:28px">${icon('shield')} Encrypted on this device</p></div>`;
  $('#useRec').onclick = () => showLock(mode === 'pin' ? 'rec' : 'pin');
  setTimeout(() => { const i = $('#pinIn') || $('#recIn'); i && i.focus(); }, 30);
  $('#lockForm').onsubmit = async e => {
    e.preventDefault();
    if (Date.now() < lockUntil) { $('#lockErr').textContent = `Too many attempts. Try again in ${Math.ceil((lockUntil - Date.now()) / 1000)} s.`; return; }
    const secret = mode === 'pin' ? $('#pinIn').value : normWords($('#recIn').value);
    if (!secret) return;
    const btn = $('#unlockBtn'); btn.disabled = true; btn.textContent = 'Unlocking…';
    let rec; try { rec = JSON.parse(store.get(KEY)); } catch (err) { rec = null; }
    try {
      const { raw, key, data } = await openRecord(rec, secret, mode !== 'pin');
      setVault({ enc: true, raw, key, meta: { pin: rec.pin, rec: rec.rec } });
      setS(migrate(data)); failCount = 0; L.classList.add('hidden'); L.innerHTML = '';
      start();
      if (mode !== 'pin') { toast('Recovered. Please set a new PIN.'); setTimeout(() => setupLock(), 300); }
    } catch (err) {
      failCount++; if (failCount >= 5) lockUntil = Date.now() + 30000 * (failCount - 4);
      btn.disabled = false; btn.textContent = mode === 'pin' ? 'Unlock' : 'Recover';
      $('#lockErr').textContent = mode === 'pin' ? 'That PIN is not right.' : 'That recovery key is not right.';
      const i = $('#pinIn'); if (i) { i.value = ''; i.focus(); }
    }
  };
}
