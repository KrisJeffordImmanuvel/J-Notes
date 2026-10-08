/* Personal mode, first start on a device: sign in with the owner's Google account and bring the notes down. */
import { $, esc } from '../lib/util.js';
import { store, KEY } from '../lib/storage.js';
import { S, setS, setVault, defaultData, migrate } from '../data/state.js';
import { signInOnNewDevice } from '../data/sync.js';
import { googleButton } from './account.js';
import { showLock } from './lock.js';
import { toast } from './toast.js';
import { start } from '../app.js';

export function showSignInGate() {
  const L = $('#lockScreen');
  L.classList.remove('hidden');
  L.innerHTML = `<div class="lock-card"><div class="logo">J</div><h1>J Notes</h1>
    <p class="muted">Sign in with your Google account to open your notes on this device.</p>
    <div class="gate-btn">${googleButton('id="gateGoogle"')}</div>
    <div class="err-text" id="gateErr" role="alert"></div>
    <p class="muted small" style="margin-top:28px">Private notes — only the owner's Google account can open them.</p></div>`;
  $('#gateGoogle').onclick = async () => {
    const btn = $('#gateGoogle'), err = $('#gateErr');
    btn.disabled = true; err.textContent = '';
    try {
      const { text, profile } = await signInOnNewDevice();
      if (!text) {   // the very first device: start empty, then the app asks for a PIN
        closeGate();
        setS(migrate(defaultData())); setVault({ enc: false });
        S.settings.name = profile.givenName || '';
        start();
        return;
      }
      await store.set(KEY, text);
      const rec = JSON.parse(text);
      closeGate();
      if (rec.enc) {
        setVault({ enc: true, meta: { pin: rec.pin, rec: rec.rec }, lockAt: rec.lockAt || 0 });
        showLock();
        toast(`Signed in as ${profile.email}. Enter your J Notes PIN to open your notes.`, null, 7000);
      } else {
        setS(migrate(rec.data)); setVault({ enc: false, lockAt: rec.lockAt || 0 });
        start();
      }
    } catch (e) {
      err.innerHTML = esc(e && e.message ? e.message : 'Sign-in failed. Please try again.');
      btn.disabled = false;
    }
  };
}

function closeGate() { const L = $('#lockScreen'); L.classList.add('hidden'); L.innerHTML = ''; }
