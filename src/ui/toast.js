/* Small, polite notifications with an optional action button. */
import { $, esc } from '../lib/util.js';

export function toast(msg, action, ms = 4200) {
  const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status');
  t.innerHTML = `<span>${esc(msg)}</span>`;
  if (action) { const b = document.createElement('button'); b.textContent = action.label; b.onclick = () => { t.remove(); action.fn(); }; t.appendChild(b); }
  $('#toasts').appendChild(t); setTimeout(() => t.remove(), action ? ms + 2000 : ms);
}
