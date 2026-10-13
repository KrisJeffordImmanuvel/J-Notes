/* Find in note (Ctrl+F): highlights every match on a backdrop under the textarea and steps through them. */
import { $, esc } from '../lib/util.js';
import { UI } from '../data/state.js';
import { togglePreview } from './view.js';

let hits = [], cur = -1, open = false;
export const isFindOpen = () => open;

export function openFind() {
  if (UI.preview) togglePreview(false);
  open = true;
  const bar = $('#findBar'), inp = $('#findIn');
  bar.classList.remove('hidden');
  const ta = $('#edText'), sel = ta.value.slice(ta.selectionStart, ta.selectionEnd);
  if (sel && !sel.includes('\n') && sel.length < 80) inp.value = sel;
  inp.focus(); inp.select();
  findRefresh();
}

export function closeFind() {
  open = false; hits = []; cur = -1;
  const bar = $('#findBar'); if (bar) bar.classList.add('hidden');
  const bd = $('#edBackdrop'); if (bd) bd.innerHTML = '';
  const ta = $('#edText'); if (ta) ta.focus();
}

/** Re-run the search (after typing in either box). `jump` moves to the match nearest the caret. */
export function findRefresh(jump = true) {
  const inp = $('#findIn'), ta = $('#edText'); if (!inp || !ta) return;
  if (!inp.oninput) {
    inp.oninput = () => findRefresh();
    inp.onkeydown = e => {
      if (e.key === 'Enter') { e.preventDefault(); step(e.shiftKey ? -1 : 1); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeFind(); }
    };
  }
  const q = inp.value.toLowerCase(), text = ta.value, hay = text.toLowerCase();
  hits = [];
  if (q) for (let i = hay.indexOf(q); i >= 0; i = hay.indexOf(q, i + q.length)) hits.push([i, i + q.length]);
  if (jump || cur >= hits.length) cur = hits.length ? Math.max(0, hits.findIndex(h => h[0] >= ta.selectionStart)) : -1;
  draw(jump);
}

export function step(dir) {
  if (!hits.length) return;
  cur = (cur + dir + hits.length) % hits.length;
  draw(true);
}

function draw(scroll) {
  const ta = $('#edText'), bd = $('#edBackdrop'), count = $('#findCount'), q = $('#findIn').value;
  count.textContent = !q ? '' : hits.length ? `${cur + 1} of ${hits.length}` : 'No matches';
  let html = '', last = 0;
  hits.forEach(([a, b], i) => { html += esc(ta.value.slice(last, a)) + `<mark${i === cur ? ' class="cur"' : ''}>${esc(ta.value.slice(a, b))}</mark>`; last = b; });
  bd.innerHTML = html + esc(ta.value.slice(last)) + '\n';
  if (scroll && cur >= 0) {
    const [a, b] = hits[cur];
    ta.setSelectionRange(a, b);
    const m = bd.querySelector('mark.cur'), sc = $('#edScroll');
    if (m && sc) {
      const top = m.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop;
      if (top < sc.scrollTop + 40 || top > sc.scrollTop + sc.clientHeight - 60) sc.scrollTop = top - sc.clientHeight * 0.35;
    }
  }
}
