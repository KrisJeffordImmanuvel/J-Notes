/* Modal dialogs and pop-up menus. */
import { $, esc } from '../lib/util.js';
import { icon } from '../lib/icons.js';

let modalOnClose = null;
export const isModalOpen = () => !!$('#modalRoot').innerHTML;
/** Drop the pending close callback (used when one dialog hands over to the next). */
export const clearModalOnClose = () => { modalOnClose = null; };

export function modal({ title, body, foot, wide, onClose }) {
  closeModal(); closeMenu();
  const root = $('#modalRoot');
  root.innerHTML = `<div class="backdrop" id="backdrop"><div class="modal${wide ? ' wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="modal-head"><h2>${esc(title)}</h2><button class="icon-btn" data-act="closeModal" aria-label="Close">${icon('x')}</button></div>
    <div class="modal-body">${body}</div>${foot ? `<div class="modal-foot">${foot}</div>` : ''}</div></div>`;
  modalOnClose = onClose || null;
  $('#backdrop').addEventListener('mousedown', e => { if (e.target.id === 'backdrop') closeModal(); });
  const f = root.querySelector('[autofocus]') || root.querySelector('.modal-body input, .modal-body button, .modal-foot button');
  if (f) setTimeout(() => f.focus(), 20);
  return root.querySelector('.modal');
}
export function closeModal() {
  const r = $('#modalRoot'); if (!r.innerHTML) return;
  r.innerHTML = ''; const cb = modalOnClose; modalOnClose = null; if (cb) cb();
}
export function promptModal({ title, label, value = '', type = 'text', ok = 'OK', help = '' }) {
  return new Promise(res => {
    let done = false;
    modal({
      title, onClose: () => { if (!done) res(null); },
      body: `<form id="pmForm"><div class="field"><label for="pmIn">${esc(label)}</label><input class="input" id="pmIn" type="${type}" value="${esc(value)}" autofocus autocomplete="off">${help ? `<div class="help">${help}</div>` : ''}</div></form>`,
      foot: `<button class="btn" data-act="closeModal">Cancel</button><button class="btn primary" id="pmOk">${esc(ok)}</button>`
    });
    const submit = e => { e && e.preventDefault(); done = true; const v = $('#pmIn').value; closeModal(); res(v); };
    $('#pmForm').onsubmit = submit; $('#pmOk').onclick = submit;
    setTimeout(() => { const i = $('#pmIn'); if (i) i.select(); }, 30);
  });
}
export function confirmModal({ title, text, ok = 'Confirm', danger }) {
  return new Promise(res => {
    let done = false;
    modal({ title, onClose: () => { if (!done) res(false); }, body: `<p style="margin-top:0">${text}</p>`, foot: `<button class="btn" data-act="closeModal">Cancel</button><button class="btn ${danger ? 'danger' : 'primary'}" id="cmOk">${esc(ok)}</button>` });
    $('#cmOk').onclick = () => { done = true; closeModal(); res(true); };
  });
}

/* ---------- menus ---------- */
export function openMenu(anchor, items) {
  closeMenu();
  const m = document.createElement('div'); m.className = 'menu'; m.id = 'menu'; m.setAttribute('role', 'menu');
  items.forEach(it => {
    if (it === '-') { m.appendChild(document.createElement('hr')); return; }
    const b = document.createElement('button'); b.setAttribute('role', 'menuitem');
    b.innerHTML = (it.icon ? icon(it.icon) : '') + `<span>${esc(it.label)}</span>`;
    if (it.danger) b.className = 'danger';
    b.onclick = () => { closeMenu(); it.fn(); };
    m.appendChild(b);
  });
  document.body.appendChild(m);
  const r = anchor.getBoundingClientRect(), w = m.offsetWidth, h = m.offsetHeight;
  let left = Math.min(Math.max(8, r.right - w), innerWidth - w - 8), top = r.bottom + 4;
  if (top + h > innerHeight - 8) top = Math.max(8, r.top - h - 4);
  m.style.left = left + 'px'; m.style.top = top + 'px';
  const first = m.querySelector('button'); if (first) first.focus();
  // arrow-key navigation inside the menu
  m.addEventListener('keydown', e => {
    const bs = [...m.querySelectorAll('button')], i = bs.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); bs[(i + 1) % bs.length].focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); bs[(i - 1 + bs.length) % bs.length].focus(); }
  });
  setTimeout(() => document.addEventListener('mousedown', menuOutside), 0);
}
function menuOutside(e) { if (!e.target.closest('#menu')) closeMenu(); }
export function closeMenu() { const m = $('#menu'); if (m) m.remove(); document.removeEventListener('mousedown', menuOutside); }
export const isMenuOpen = () => !!$('#menu');
