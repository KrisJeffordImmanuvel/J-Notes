/* Home dashboard. */
import { $, esc, ymd, rel, fmtDate, parseYmd, longDate } from '../lib/util.js';
import { icon } from '../lib/icons.js';
import { plain } from '../lib/markdown.js';
import { MOODS, PROMPTS } from '../data/constants.js';
import { S, vault, live, diaryFor, noteTitle, isLockedPriv, isEmptyNote, newNote } from '../data/state.js';
import { scheduleSave, lastSaved, getSnaps } from '../data/persist.js';
import { folder } from '../data/folder.js';
import { promptIdx } from './editor.js';
import { renderSidebar } from './sidebar.js';
import { openNote } from './nav.js';
import { toast } from './toast.js';
import { homeSyncLine } from './account.js';

export function onThisDay(date) {
  const md = date.slice(5);
  return live().filter(n => n.type === 'diary' && n.date.slice(5) === md && n.date < date).sort((a, b) => b.date.localeCompare(a.date));
}
export function renderHome(m) {
  const st = S.settings, h = new Date().getHours();
  const greet = h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const today = ymd(), td = diaryFor(today), L = live();
  const notes = L.filter(n => n.type === 'note');
  const recent = [...notes].sort((a, b) => b.updated - a.updated).slice(0, 6);
  const pinned = L.filter(n => n.pinned).slice(0, 6);
  const otd = onThisDay(today);
  const snaps = getSnaps();
  const empties = notes.filter(n => isEmptyNote(n));
  const mini = arr => `<div class="mini">${arr.map(n => `<button data-act="openNote" data-id="${n.id}">${n.type === 'diary' ? icon('book') : icon('notes')}<span class="t">${esc(noteTitle(n))}</span><span class="d">${n.type === 'diary' ? fmtDate(parseYmd(n.date)) : rel(n.updated)}</span></button>`).join('')}</div>`;
  const tdBody = td && !isLockedPriv(td) ? plain(td.body).slice(0, 180) : '';
  m.innerHTML = `<div class="scroll"><div class="home">
    <div class="home-head" style="display:flex;gap:8px;align-items:flex-start"><button class="icon-btn mobile-only" data-act="openNav" aria-label="Open menu">${icon('menu')}</button>
      <div><h1>${greet}${st.name ? ', ' + esc(st.name) : ''}</h1><p>${esc(longDate(today))}</p></div></div>
    <button class="home-search" data-act="search">${icon('search')} Search notes and diary… <kbd>Ctrl K</kbd></button>
    <div class="grid">
      <div class="card hero"><h3>${icon('book')} Today's diary</h3>
        ${td ? `<p class="big">${esc(td.title || 'Your entry for today')}</p><p class="muted" style="margin:0">${esc(tdBody || (isLockedPriv(td) ? 'Private entry' : 'Nothing written yet.'))}</p>
          <div class="row"><button class="btn primary" data-act="today">${icon('pen')} Continue writing</button>${td.mood ? `<span class="badge"><i class="mood-dot" style="background:${MOODS[td.mood].c}"></i> ${MOODS[td.mood].n}</span>` : ''}</div>`
      : `<p class="big">${esc(PROMPTS[promptIdx])}</p><p class="muted" style="margin:0">Your page for today is ready.</p>
          <div class="row"><button class="btn primary" data-act="today">${icon('pen')} Start today's entry</button><button class="btn ghost" data-act="diary">Open calendar</button></div>`}
      </div>
      <div class="card quick"><h3>${icon('edit')} Quick note</h3>
        <textarea id="quickText" placeholder="Jot something down… the first line becomes the title." aria-label="Quick note"></textarea>
        <div class="row"><button class="btn sm primary" data-act="quickSave">Save note</button><span class="muted small">or Ctrl + Enter</span></div></div>
      ${pinned.length ? `<div class="card"><h3>${icon('pin')} Pinned</h3>${mini(pinned)}</div>` : ''}
      <div class="card"><h3>${icon('clock')} Recent notes</h3>${recent.length ? mini(recent) : '<p class="muted">No notes yet.</p>'}
        <div class="row"><button class="btn sm" data-act="newNote">${icon('plus')} New note</button><button class="btn sm ghost" data-act="filter" data-kind="all">See all</button></div></div>
      ${otd.length ? `<div class="card"><h3>${icon('calendar')} On this day</h3>${mini(otd)}</div>` : ''}
      <div class="card"><h3>${icon('shield')} Your data</h3><ul class="stat-list">
        <li>${icon('check1', 'ok')}<span>Saved on this device · ${rel(lastSaved)}</span></li>
        <li>${vault.enc ? `${icon('lock', 'ok')}<span>Encrypted with your PIN (AES-256-GCM)</span>` : `${icon('alert', 'warnc')}<span>Not encrypted — <button class="linkish" data-act="settings" data-tab="security">turn on app lock</button></span>`}</li>
        <li>${snaps.length ? `${icon('restore', 'ok')}<span>${snaps.length} daily snapshot${snaps.length > 1 ? 's' : ''} · latest ${fmtDate(snaps[snaps.length - 1].t)}</span>` : `${icon('alert', 'warnc')}<span>No snapshots yet</span>`}</li>
        <li>${folder.handle ? `${icon('folderSync', 'ok')}<span>Syncing to folder “${esc(folder.handle.name)}”</span>` : folder.pending ? `${icon('folderSync', 'warnc')}<span>Folder sync paused — <button class="linkish" data-act="reconnectFolder">reconnect “${esc(folder.pending.name)}”</button></span>` : `${icon('cloud', 'warnc')}<span>No off-device backup — <button class="linkish" data-act="settings" data-tab="backup">set one up</button></span>`}</li>
        ${homeSyncLine()}
        <li>${icon('notes')}<span>${notes.length} note${notes.length === 1 ? '' : 's'} · ${L.filter(n => n.type === 'diary').length} diary entr${L.filter(n => n.type === 'diary').length === 1 ? 'y' : 'ies'}</span></li>
      </ul></div>
      ${empties.length ? `<div class="card"><h3>${icon('trash')} Tidy up</h3><p class="muted" style="margin:0">${empties.length} empty note${empties.length > 1 ? 's are' : ' is'} taking up space.</p><div class="row"><button class="btn sm" data-act="tidyEmpty">Move to Trash</button></div></div>` : ''}
    </div></div></div>`;
  const q = $('#quickText');
  q.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); quickSave(); } });
}
export function quickSave() {
  const q = $('#quickText'); const v = q.value.trim(); if (!v) { q.focus(); return; }
  const lines = v.split('\n'); const title = lines[0].replace(/^#+\s*/, '').slice(0, 80);
  const body = lines[0].length > 80 ? v : lines.slice(1).join('\n').trim();
  const n = newNote({ title, body }); S.notes.push(n); scheduleSave();
  q.value = ''; renderHome($('#main')); renderSidebar();
  toast('Note saved', { label: 'Open', fn: () => openNote(n.id) });
}
