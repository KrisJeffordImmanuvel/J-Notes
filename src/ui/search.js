/* Search dialog (Ctrl/⌘ + K) with filters and keyboard navigation. */
import { $, $$, esc, reEsc, ymd, rel, fmtDate, parseYmd } from '../lib/util.js';
import { icon } from '../lib/icons.js';
import { plain } from '../lib/markdown.js';
import { S, live, allTags, noteTitle, isLockedPriv } from '../data/state.js';
import { modal } from './modal.js';

let searchSel = 0;
export function openSearch() {
  const nbs = S.notebooks.map(b => `<option value="${b.id}">${esc(b.name)}</option>`).join('');
  const tags = allTags().map(t => `<option value="${esc(t)}">#${esc(t)}</option>`).join('');
  modal({
    title: 'Search', body: `<input class="input" id="sq" placeholder="Search notes, diary and tags…" autofocus aria-label="Search">
    <div class="filters"><select class="input" id="sType" aria-label="Type"><option value="">Everything</option><option value="note">Notes</option><option value="diary">Diary</option></select>
      <select class="input" id="sNb" aria-label="Notebook"><option value="">Any notebook</option>${nbs}</select>
      <select class="input" id="sTag" aria-label="Tag"><option value="">Any tag</option>${tags}</select>
      <input class="input" type="date" id="sFrom" aria-label="From date" title="From"><input class="input" type="date" id="sTo" aria-label="To date" title="To"></div>
    <div class="search-results" id="sRes" role="listbox"></div>`
  });
  ['sq', 'sType', 'sNb', 'sTag', 'sFrom', 'sTo'].forEach(id => $('#' + id).addEventListener('input', () => { searchSel = 0; runSearch(); }));
  $('#sq').addEventListener('keydown', e => {
    const items = $$('#sRes .sr');
    if (e.key === 'ArrowDown') { e.preventDefault(); searchSel = Math.min(items.length - 1, searchSel + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); searchSel = Math.max(0, searchSel - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); if (items[searchSel]) items[searchSel].click(); return; }
    else return;
    items.forEach((it, i) => it.classList.toggle('kb', i === searchSel)); items[searchSel] && items[searchSel].scrollIntoView({ block: 'nearest' });
  });
  searchSel = 0; runSearch();
}
export function highlight(text, terms) {
  let h = esc(text);
  terms.forEach(t => { const et = esc(t); if (et) h = h.replace(new RegExp(reEsc(et), 'gi'), m => `<mark>${m}</mark>`); });
  return h;
}
function runSearch() {
  const q = $('#sq').value.trim().toLowerCase(), terms = q.split(/\s+/).filter(Boolean);
  const type = $('#sType').value, nb = $('#sNb').value, tag = $('#sTag').value, from = $('#sFrom').value, to = $('#sTo').value;
  let res = live().filter(n => {
    if (type && n.type !== type) return false;
    if (nb && n.notebookId !== nb) return false;
    if (tag && !n.tags.includes(tag)) return false;
    const d = n.date || ymd(new Date(n.updated));
    if (from && d < from) return false; if (to && d > to) return false;
    return true;
  }).map(n => {
    const title = noteTitle(n).toLowerCase(), body = isLockedPriv(n) ? '' : plain(n.body).toLowerCase(), tg = n.tags.join(' ');
    let score = 0;
    for (const t of terms) {
      const inT = title.includes(t), inB = body.includes(t), inG = tg.includes(t.replace(/^#/, ''));
      if (!inT && !inB && !inG) return null;
      score += (inT ? 5 : 0) + (inG ? 3 : 0) + (inB ? 1 : 0);
    }
    return { n, score };
  }).filter(Boolean);
  res.sort((a, b) => b.score - a.score || b.n.updated - a.n.updated);
  res = res.slice(0, terms.length ? 60 : 8);
  const box = $('#sRes');
  if (!res.length) { box.innerHTML = `<div class="empty" style="padding:24px">No results${q ? ` for “${esc(q)}”` : ''}.</div>`; return; }
  box.innerHTML = (terms.length ? '' : '<div class="muted small" style="padding:4px 10px">Recently edited</div>') + res.map(({ n }, i) => {
    const body = isLockedPriv(n) ? 'Private entry' : plain(n.body);
    let idx = terms.length ? body.toLowerCase().indexOf(terms[0]) : 0; if (idx < 0) idx = 0;
    const snip = (idx > 40 ? '…' : '') + body.slice(Math.max(0, idx - 40), idx + 140);
    return `<button class="sr${i === searchSel ? ' kb' : ''}" data-act="openNoteM" data-id="${n.id}" role="option">
      <div style="display:flex;gap:8px;align-items:center">${icon(n.type === 'diary' ? 'book' : 'notes')}<strong>${highlight(noteTitle(n), terms)}</strong><span class="spacer"></span><span class="muted small">${n.type === 'diary' ? fmtDate(parseYmd(n.date)) : rel(n.updated)}</span></div>
      <div class="s">${highlight(snip, terms) || '<i>Empty</i>'}</div></button>`;
  }).join('');
}
