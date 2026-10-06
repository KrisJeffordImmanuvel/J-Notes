/* Version history dialog. */
import { $, esc, rel, fmtTime, wordCount } from '../lib/util.js';
import { renderMd } from '../lib/markdown.js';
import { snapshotHistory } from '../data/state.js';
import { scheduleSave } from '../data/persist.js';
import { modal, closeModal } from './modal.js';
import { toast } from './toast.js';
import { renderEditor } from './editor.js';
import { refreshSide } from './nav.js';

export function openHistory(n) {
  if (n.priv) { toast('Private entries do not keep version history.'); return; }
  snapshotHistory(n, true);
  const h = [...n.history].reverse();
  if (!h.length) { toast('No earlier versions yet.'); return; }
  let sel = Math.min(1, h.length - 1);
  modal({
    title: 'Version history', wide: true,
    body: `<div class="hist"><div class="hist-list" id="hList"></div><div class="hist-prev md" id="hPrev"></div></div>`,
    foot: `<span class="muted small" style="margin-right:auto">Versions are saved every few minutes while you write.</span><button class="btn" data-act="closeModal">Close</button><button class="btn primary" id="hRestore">Restore this version</button>`
  });
  const draw = () => {
    $('#hList').innerHTML = h.map((v, i) => `<button class="${i === sel ? 'on' : ''}" data-i="${i}">${i === 0 ? 'Current version' : rel(v.t)}<small>${fmtTime(v.t)} · ${wordCount(v.body)} words</small></button>`).join('');
    $('#hPrev').innerHTML = `<h2 style="margin-top:0">${esc(h[sel].title || 'Untitled')}</h2>` + renderMd(h[sel].body, { readonly: true });
    $('#hRestore').disabled = sel === 0;
  };
  $('#hList').onclick = e => { const b = e.target.closest('[data-i]'); if (b) { sel = +b.dataset.i; draw(); } };
  $('#hRestore').onclick = () => {
    const v = h[sel]; n.title = v.title; n.body = v.body; n.updated = Date.now();
    snapshotHistory(n, true); scheduleSave(); closeModal(); renderEditor(); refreshSide(); toast('Version restored — the previous text is still in history.');
  };
  draw();
}
