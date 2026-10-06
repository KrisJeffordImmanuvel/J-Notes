/* Notes view: list pane + editor pane. */
import { $, esc, rel, fmtDate, parseYmd } from '../lib/util.js';
import { icon } from '../lib/icons.js';
import { plain } from '../lib/markdown.js';
import { MOODS } from '../data/constants.js';
import { UI, nbName, noteTitle, isLockedPriv } from '../data/state.js';
import { filteredNotes } from './nav.js';
import { renderEditor } from './editor.js';

function listTitle() {
  const f = UI.filter;
  return { all: 'All notes', fav: 'Favorites', trash: 'Trash' }[f.kind] || (f.kind === 'notebook' ? nbName(f.id) : '#' + f.id);
}
function noteItem(n) {
  const locked = isLockedPriv(n);
  const snip = locked ? 'Private entry' : (plain(n.body).slice(0, 160) || 'No content yet');
  const meta = [];
  if (n.deleted) meta.push(`Deleted ${rel(n.deleted)} · ${Math.max(0, 30 - Math.floor((Date.now() - n.deleted) / 864e5))} days left`);
  else meta.push(n.type === 'diary' ? fmtDate(parseYmd(n.date)) : rel(n.updated));
  if (n.mood) meta.push(`<i class="mood-dot" style="background:${MOODS[n.mood].c}" title="${MOODS[n.mood].n}"></i>`);
  if (UI.filter.kind !== 'notebook' && n.notebookId && nbName(n.notebookId)) meta.push(esc(nbName(n.notebookId)));
  n.tags.slice(0, 3).forEach(t => meta.push(`<span class="t">#${esc(t)}</span>`));
  return `<button class="note-item${n.id === UI.current ? ' active' : ''}" data-act="openNote" data-id="${n.id}">
    <div class="ni-title">${n.pinned && !n.deleted ? icon('pin') : ''}${n.type === 'diary' ? icon('book') : ''}${n.priv ? icon('lock') : ''}<span>${esc(noteTitle(n))}</span>${n.fav ? icon('star') : ''}</div>
    <div class="ni-snip">${esc(snip)}</div><div class="ni-meta">${meta.join('<span>·</span>')}</div></button>`;
}
export function renderNotes(m) {
  const trash = UI.filter.kind === 'trash';
  m.innerHTML = `<div class="notes-view${UI.mobileEditor ? ' show-editor' : ''}">
    <section class="list-pane" aria-label="Notes list">
      <div class="pane-head"><button class="icon-btn mobile-only" data-act="openNav" aria-label="Open menu">${icon('menu')}</button>
        <h2>${esc(listTitle())}</h2><span class="spacer"></span>
        ${trash ? `<button class="btn sm danger" data-act="emptyTrash">Empty</button>` : `<button class="icon-btn" data-act="sortMenu" title="Sort" aria-label="Sort">${icon('olist')}</button><button class="icon-btn" data-act="newNote" title="New note (Alt+N)" aria-label="New note">${icon('plus')}</button>`}
      </div>
      <div class="list-filter"><input class="input" id="listQ" placeholder="Filter this list…" value="${esc(UI.listQ)}" aria-label="Filter notes"></div>
      ${trash ? `<div class="muted small" style="padding:0 16px 8px">Notes are deleted forever after 30 days.</div>` : ''}
      <div class="list" id="list"></div>
    </section>
    <section class="editor-pane" id="editorPane"></section></div>`;
  $('#listQ').addEventListener('input', e => { UI.listQ = e.target.value; renderList(); });
  renderList(); renderEditor();
}
export function renderList() {
  const el = $('#list'); if (!el) return;
  const arr = filteredNotes(), st = el.scrollTop;
  el.innerHTML = arr.length ? arr.map(noteItem).join('') : `<div class="empty">${icon(UI.filter.kind === 'trash' ? 'trash' : 'notes')}<h3>${UI.listQ ? 'No matches' : UI.filter.kind === 'trash' ? 'Trash is empty' : 'Nothing here yet'}</h3><p>${UI.filter.kind === 'trash' ? 'Deleted notes wait here for 30 days.' : 'Create a note to get started.'}</p></div>`;
  el.scrollTop = st;
}
