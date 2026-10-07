/* First-run onboarding (3 short steps). */
import { $, $$, esc } from '../lib/util.js';
import { icon } from '../lib/icons.js';
import { S } from '../data/state.js';
import { scheduleSave } from '../data/persist.js';
import { modal, closeModal, clearModalOnClose } from './modal.js';
import { toast } from './toast.js';
import { render, applySettings } from './nav.js';
import { setupLock } from './lock.js';
import { googleAvailable } from '../lib/google.js';
import { googleButton } from './account.js';

export function onboarding(step = 1) {
  const st = S.settings;
  const dots = `<div style="display:flex;gap:6px;margin-right:auto">${[1, 2, 3].map(i => `<i class="mood-dot" style="background:${i <= step ? 'var(--accent)' : 'var(--line)'}"></i>`).join('')}</div>`;
  const fin = () => { st.onboarded = true; scheduleSave(); };
  if (step === 1) {
    modal({
      title: 'Welcome to J Notes', onClose: fin,
      body: `<p style="font-size:16px;margin-top:0;font-family:var(--font-serif)">Private by design. Yours forever. Simple to use.</p>
      <ul class="stat-list" style="margin:14px 0 18px"><li>${icon('shield', 'ok')}<span>Your notes stay on this device. No account needed, no tracking, no ads.</span></li><li>${icon('notes', 'ok')}<span>Everything is plain Markdown you can export any time.</span></li><li>${icon('book', 'ok')}<span>A calm diary with a calendar, moods and gentle prompts.</span></li></ul>
      <div class="field"><label for="obName">What should we call you? <span class="muted">(optional)</span></label><input class="input" id="obName" value="${esc(st.name)}" autofocus></div>
      ${googleAvailable() ? `<div class="ob-google"><span class="muted small">Already use J Notes on another device, or want your notes everywhere?</span>${googleButton('data-onboard="1"')}</div>` : ''}`,
      foot: `${dots}<button class="btn primary" id="obNext">Next</button>`
    });
    const next = () => { st.name = $('#obName').value.trim(); clearModalOnClose(); onboarding(2); };
    $('#obNext').onclick = next; $('#obName').onkeydown = e => { if (e.key === 'Enter') next(); };
  } else if (step === 2) {
    const tiles = [['auto', 'Automatic'], ['light', 'Light'], ['dark', 'Dark'], ['night', 'Warm night']];
    modal({
      title: 'Pick a look', onClose: fin,
      body: `<p class="muted" style="margin-top:0">You can change this any time in Settings.</p><div class="seg" id="obTheme">${tiles.map(([k, l]) => `<button class="${st.theme === k ? 'on' : ''}" data-v="${k}">${l}</button>`).join('')}</div>
      <h4 style="margin:18px 0 8px">Writing font</h4><div class="seg" id="obFont">${[['sans', 'Sans'], ['serif', 'Serif']].map(([k, l]) => `<button class="${st.font === k ? 'on' : ''}" data-v="${k}">${l}</button>`).join('')}</div>`,
      foot: `${dots}<button class="btn" id="obBack">Back</button><button class="btn primary" id="obNext">Next</button>`
    });
    const seg = (id, key) => $(id).onclick = e => { const b = e.target.closest('[data-v]'); if (!b) return; st[key] = b.dataset.v; applySettings(); $$(id + ' button').forEach(x => x.classList.toggle('on', x === b)); };
    seg('#obTheme', 'theme'); seg('#obFont', 'font');
    $('#obBack').onclick = () => { clearModalOnClose(); onboarding(1); }; $('#obNext').onclick = () => { clearModalOnClose(); onboarding(3); };
  } else {
    modal({
      title: 'Protect your notes', onClose: fin,
      body: `<p style="margin-top:0">Set a PIN to encrypt everything on this device. You'll get a 24-word recovery key in case you ever forget it.</p><p class="muted small">You can also do this later in Settings → Security.</p>`,
      foot: `${dots}<button class="btn" id="obSkip">Maybe later</button><button class="btn primary" id="obLock">${icon('lock')} Set up app lock</button>`
    });
    $('#obSkip').onclick = () => { closeModal(); render(); toast('All set. Press Alt + D to start today’s diary.'); };
    $('#obLock').onclick = () => { clearModalOnClose(); fin(); setupLock(); };
  }
}
