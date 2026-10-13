/* Version history of the note. */
import { $, esc, rel, fmtTime, wordCount } from '../lib/util.js';
import { renderMd } from '../lib/markdown.js';
import { note, snapshotHistory } from '../data/state.js';
import { scheduleSave } from '../data/persist.js';
import { modal, closeModal } from './modal.js';
import { toast } from './toast.js';
import { render } from './view.js';

export function openHistory() {
  const n = note();
  snapshotHistory(n, true);
  const h = [...n.history].reverse();
  if (!h.length) { toast('No earlier versions yet — they are saved every few minutes while you write.'); return; }
  let sel = Math.min(1, h.length - 1);
  modal({
    title: 'Version history', wide: true,
    body: `<div class="hist"><div class="hist-list" id="hList"></div><div class="hist-prev md" id="hPrev"></div></div>`,
    foot: `<span class="muted small" style="margin-right:auto">Versions are saved every few minutes while you write.</span><button class="btn" data-act="closeModal">Close</button><button class="btn primary" id="hRestore">Restore this version</button>`
  });
  const draw = () => {
    $('#hList').innerHTML = h.map((v, i) => `<button class="${i === sel ? 'on' : ''}" data-i="${i}">${i === 0 ? 'Current version' : esc(rel(v.t))}<small>${esc(fmtTime(v.t))} · ${wordCount(v.body)} words</small></button>`).join('');
    $('#hPrev').innerHTML = renderMd(h[sel].body, { readonly: true }) || '<p class="muted">Empty</p>';
    $('#hRestore').disabled = sel === 0;
  };
  $('#hList').onclick = e => { const b = e.target.closest('[data-i]'); if (b) { sel = +b.dataset.i; draw(); } };
  $('#hRestore').onclick = () => {
    n.body = h[sel].body; n.updated = Date.now();
    snapshotHistory(n, true); scheduleSave(); closeModal(); render(); toast('Version restored — the previous text is still in history.');
  };
  draw();
}
