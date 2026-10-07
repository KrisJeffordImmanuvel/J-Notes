/* Sidebar navigation. */
import { $, esc } from '../lib/util.js';
import { icon } from '../lib/icons.js';
import { S, UI, vault, live, allTags } from '../data/state.js';
import { saveState, setSaveState } from '../data/persist.js';
import { sidebarSyncButton } from './account.js';

export function renderSidebar() {
  const sb = $('#sidebar'), L = live(), f = UI.filter, v = UI.view;
  const on = c => c ? ' active' : '';
  const cnt = fn => { const c = L.filter(fn).length; return c ? `<span class="count">${c}</span>` : ''; };
  const tags = allTags(), trashN = S.notes.filter(n => n.deleted).length;
  sb.innerHTML = `
  <div class="brand"><div class="logo">J</div><span>J Notes</span><span class="spacer"></span>
    <button class="icon-btn mobile-only" data-act="closeNav" aria-label="Close menu">${icon('x')}</button></div>
  <button class="btn primary nav-new" data-act="newNote">${icon('plus')} New note</button>
  <button class="nav-search" data-act="search">${icon('search')} Search <kbd>Ctrl K</kbd></button>
  <button class="nav-item${on(v === 'home')}" data-act="home">${icon('home')} Home</button>
  <button class="nav-item" data-act="today">${icon('sun')} Today's entry</button>
  <button class="nav-item${on(v === 'diary')}" data-act="diary">${icon('book')} Diary ${cnt(n => n.type === 'diary')}</button>
  <button class="nav-item${on(v === 'notes' && f.kind === 'all')}" data-act="filter" data-kind="all">${icon('notes')} All notes ${cnt(n => n.type === 'note')}</button>
  <button class="nav-item${on(v === 'notes' && f.kind === 'fav')}" data-act="filter" data-kind="fav">${icon('star')} Favorites ${cnt(n => n.fav)}</button>
  <div class="nav-section">Notebooks <button data-act="addNotebook" aria-label="New notebook" title="New notebook">${icon('plus')}</button></div>
  ${S.notebooks.map(nb => `<div class="nav-item${on(v === 'notes' && f.kind === 'notebook' && f.id === nb.id)}" role="button" tabindex="0" data-act="filter" data-kind="notebook" data-id="${nb.id}">${icon('folder')}<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(nb.name)}</span><button class="nb-more" data-act="nbMenu" data-id="${nb.id}" aria-label="Notebook options">${icon('more')}</button>${cnt(n => n.notebookId === nb.id)}</div>`).join('')}
  ${tags.length ? `<div class="nav-section">Tags</div><div class="tag-cloud">${tags.map(t => `<button class="tag-pill${on(v === 'notes' && f.kind === 'tag' && f.id === t)}" data-act="filter" data-kind="tag" data-id="${esc(t)}">#${esc(t)}</button>`).join('')}</div>` : ''}
  <div class="nav-section"></div>
  <button class="nav-item${on(v === 'notes' && f.kind === 'trash')}" data-act="filter" data-kind="trash">${icon('trash')} Trash ${trashN ? `<span class="count">${trashN}</span>` : ''}</button>
  <button class="nav-item" data-act="settings">${icon('gear')} Settings</button>
  <div class="side-foot"><div class="side-status js-status"></div><span class="spacer"></span>${sidebarSyncButton()}
    ${vault.enc ? `<button class="icon-btn" data-act="lock" title="Lock now (Alt+L)" aria-label="Lock now">${icon('lock')}</button>` : `<button class="icon-btn" data-act="settings" data-tab="security" title="App lock is off" aria-label="Set up app lock">${icon('unlock')}</button>`}</div>`;
  setSaveState(saveState);
}
