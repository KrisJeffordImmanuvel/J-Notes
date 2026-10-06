/* Rendering entry points and navigation between views and notes. */
import { $, ymd, debounce } from '../lib/util.js';
import { prefs, THEMEKEY } from '../lib/storage.js';
import { S, UI, cur, live, diaryFor, isMobile, isEmptyNote, isLockedPriv, newNote, noteTitle, snapshotHistory } from '../data/state.js';
import { scheduleSave } from '../data/persist.js';
import { toast } from './toast.js';
import { renderSidebar } from './sidebar.js';
import { renderNotes, renderList } from './notes.js';
import { renderHome } from './home.js';
import { renderDiary, renderDiarySide } from './diary.js';

export function render() {
  if (!S) return;
  applySettings(); renderSidebar(); renderMain();
  $('#app').classList.toggle('focus', !!UI.focus);
}
export function renderMain() {
  const m = $('#main');
  if (UI.view === 'home') renderHome(m);
  else if (UI.view === 'diary') renderDiary(m);
  else renderNotes(m);
}
export function applySettings() {
  const st = S.settings; let th = st.theme;
  if (th === 'auto') th = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.dataset.theme = th; prefs.set(THEMEKEY, st.theme);
  const meta = document.querySelector('meta[name=theme-color]');
  if (meta) meta.content = getComputedStyle(document.documentElement).getPropertyValue('--panel').trim() || meta.content;
  const r = document.documentElement.style;
  r.setProperty('--ed-font', { sans: 'var(--font-ui)', serif: 'var(--font-serif)', mono: 'var(--font-mono)' }[st.font] || 'var(--font-ui)');
  r.setProperty('--ed-size', st.size + 'px'); r.setProperty('--ed-lh', st.lh); r.setProperty('--ed-width', st.width + 'px');
  document.body.classList.toggle('typewriter', !!st.typewriter);
}
export const refreshSide = debounce(() => {
  if (!S) return;
  renderSidebar(); renderList();
  if (UI.view === 'diary') renderDiarySide();
}, 500);

/* ---------- navigation ---------- */
export function leaveNote(nextId) {
  const n = cur(); if (!n || n.id === nextId) return;
  if (!n.deleted && isEmptyNote(n)) { S.notes = S.notes.filter(x => x !== n); scheduleSave(); }
  else snapshotHistory(n, true);
}
export function closeNav() { $('#app').classList.remove('nav-open'); }
export function go(view, filter) {
  leaveNote(); UI.view = view; UI.mobileEditor = false; UI.listQ = ''; UI.preview = false;
  if (view === 'home') UI.focus = false;   // focus mode needs an open note
  if (filter) UI.filter = filter;
  if (view === 'notes') { const l = filteredNotes(); UI.current = isMobile() ? null : (l[0] ? l[0].id : null); }
  else if (view === 'diary') { UI.diaryDate = UI.diaryDate || ymd(); UI.diaryMonth = UI.diaryDate.slice(0, 7); const e = diaryFor(UI.diaryDate); UI.current = e ? e.id : null; }
  else UI.current = null;
  closeNav(); render();
}
export function noteMatchesFilter(n) {
  const f = UI.filter;
  if (f.kind === 'trash') return !!n.deleted;
  if (n.deleted) return false;
  if (f.kind === 'all') return n.type === 'note';
  if (f.kind === 'fav') return n.fav;
  if (f.kind === 'notebook') return n.notebookId === f.id;
  if (f.kind === 'tag') return n.tags.includes(f.id);
  return true;
}
export function filteredNotes() {
  let arr = S.notes.filter(noteMatchesFilter);
  const q = UI.listQ.trim().toLowerCase();
  if (q) arr = arr.filter(n => (n.title + ' ' + (isLockedPriv(n) ? '' : n.body) + ' ' + n.tags.join(' ')).toLowerCase().includes(q));
  const by = UI.sort;
  arr.sort((a, b) => {
    if (UI.filter.kind !== 'trash' && a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (by === 'title') return noteTitle(a).localeCompare(noteTitle(b));
    if (by === 'created') return b.created - a.created;
    return (UI.filter.kind === 'trash' ? b.deleted - a.deleted : b.updated - a.updated);
  });
  return arr;
}
export function openNote(id) {
  const n = S.notes.find(x => x.id === id); if (!n) return;
  leaveNote(id); UI.preview = false;
  if (n.type === 'diary' && !n.deleted && (UI.view !== 'notes' || !noteMatchesFilter(n))) {
    UI.view = 'diary'; UI.diaryDate = n.date; UI.diaryMonth = n.date.slice(0, 7);
  } else if (UI.view !== 'notes' || !noteMatchesFilter(n)) {
    UI.view = 'notes'; UI.filter = n.deleted ? { kind: 'trash' } : { kind: 'all' };
  }
  UI.current = id; UI.mobileEditor = true; snapshotHistory(n, true);
  closeNav(); render();
}
export function createNote(over = {}) {
  leaveNote();
  const f = UI.filter;
  if (UI.view !== 'notes' || f.kind === 'trash') { UI.view = 'notes'; if (f.kind === 'trash') UI.filter = { kind: 'all' }; }
  const g = UI.filter;
  const n = newNote(Object.assign({ notebookId: g.kind === 'notebook' ? g.id : null, tags: g.kind === 'tag' ? [g.id] : [], fav: g.kind === 'fav' }, over));
  S.notes.push(n); UI.current = n.id; UI.mobileEditor = true; UI.preview = false; UI.listQ = '';
  closeNav(); render(); scheduleSave();
  setTimeout(() => { const t = $('#edTitle'); t && t.focus(); }, 30);
  return n;
}
export function openDiaryDate(date, create) {
  leaveNote();
  UI.view = 'diary'; UI.diaryDate = date; UI.diaryMonth = date.slice(0, 7); UI.preview = false;
  let e = diaryFor(date);
  if (!e && create) { e = newNote({ type: 'diary', date, mood: null, energy: null }); S.notes.push(e); }
  UI.current = e ? e.id : null; UI.mobileEditor = !!e;
  closeNav(); render();
  if (e && !isLockedPriv(e)) setTimeout(() => { const t = $('#edText'); if (t) { t.focus(); t.setSelectionRange(t.value.length, t.value.length); } }, 30);
}
export function openByTitle(title) {
  const t = title.trim().toLowerCase();
  const n = live().find(x => (x.title || '').trim().toLowerCase() === t);
  if (n) openNote(n.id); else { createNote({ title: title.trim() }); toast(`Created “${title.trim()}”`); }
}
export function trashNote(n) {
  n.deleted = Date.now(); scheduleSave();
  const list = filteredNotes();
  if (UI.current === n.id) { UI.current = UI.view === 'notes' && !isMobile() && list[0] ? list[0].id : null; UI.mobileEditor = false; }
  render();
  toast('Moved to Trash', { label: 'Undo', fn: () => { n.deleted = null; scheduleSave(); UI.current = n.id; render(); } });
}
