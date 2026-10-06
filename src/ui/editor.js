/* Note / diary editor: header actions, title, metadata, tags, mood, textarea, preview and backlinks. */
import { $, $$, esc, uid, rel, fmtDate, longDate, ymd, wordCount, debounce } from '../lib/util.js';
import { icon } from '../lib/icons.js';
import { renderMd } from '../lib/markdown.js';
import { MOODS, ENERGY, PROMPTS } from '../data/constants.js';
import { S, UI, vault, cur, live, allTags, noteTitle, isLockedPriv, snapshotHistory } from '../data/state.js';
import { scheduleSave, saveState, setSaveState } from '../data/persist.js';
import { unlockPrivate } from '../data/vault.js';
import { promptModal } from './modal.js';
import { toast } from './toast.js';
import { renderSidebar } from './sidebar.js';
import { refreshSide, openByTitle } from './nav.js';
import { editorKeys } from './format.js';

const TB = [['h', 'Heading', 'heading'], ['bold', 'Bold (Ctrl+B)', 'bold'], ['italic', 'Italic (Ctrl+I)', 'italic'], ['strike', 'Strikethrough', 'strike'], '|',
['list', 'Bullet list', 'ul'], ['olist', 'Numbered list', 'ol'], ['check', 'Checklist', 'task'], '|', ['quote', 'Quote', 'quote'], ['code', 'Code', 'code'], ['link', 'Link', 'link'], ['image', 'Insert image', 'image'], ['hr', 'Divider', 'hr']];
function toolbarHTML(isD) {
  let items = [...TB];
  if (S.settings.power) items.push('|', ['wiki', 'Link to another note [[ ]]', 'wiki'], ['template', 'Insert template', 'template']);
  if (isD) items.push('|', ['bulb', 'Writing prompt', 'prompt']);
  return `<div class="toolbar" id="toolbar" role="toolbar" aria-label="Formatting">${items.map(t => t === '|' ? '<span class="sep"></span>' : `<button class="icon-btn" data-act="fmt" data-f="${t[2]}" title="${t[1]}" aria-label="${t[1]}">${icon(t[0])}</button>`).join('')}</div>`;
}
function tagsHTML(n) {
  return `<div class="chips" id="tagChips">${icon('tag')}${n.tags.map(t => `<span class="chip">#${esc(t)}<button data-act="rmTag" data-tag="${esc(t)}" aria-label="Remove tag ${esc(t)}">${icon('x')}</button></span>`).join('')}
    <input class="tag-input" id="tagInput" placeholder="Add tag" list="tagList" aria-label="Add tag" ${UI.preview ? 'disabled' : ''}>
    <datalist id="tagList">${allTags().filter(t => !n.tags.includes(t)).map(t => `<option value="${esc(t)}">`).join('')}</datalist>
    <span class="chips" id="tagSugg"></span></div>`;
}
function moodHTML(n) {
  return `<div class="mood-row" id="moodRow"><span class="lbl">Mood</span>${[5, 4, 3, 2, 1].map(i => `<button class="mood-btn${n.mood === i ? ' sel' : ''}" data-act="setMood" data-v="${i}"><i class="mood-dot" style="background:${MOODS[i].c}"></i>${MOODS[i].n}</button>`).join('')}</div>
  <div class="mood-row" id="energyRow" style="margin-top:-10px"><span class="lbl">Energy</span>${ENERGY.map((e, i) => `<button class="mood-btn${n.energy === i ? ' sel' : ''}" data-act="setEnergy" data-v="${i}">${e}</button>`).join('')}</div>`;
}
export let promptIdx = Math.floor(Math.random() * PROMPTS.length);
export const nextPromptIdx = () => { promptIdx = (promptIdx + 1) % PROMPTS.length; return promptIdx; };
export function renderEditor() {
  const pane = $('#editorPane'); if (!pane) return;
  const n = cur();
  const back = `<button class="icon-btn mobile-only" data-act="mobileBack" aria-label="Back">${icon('back')}</button>`;
  if (!n) {
    if (UI.view === 'diary') {
      const d = UI.diaryDate, future = d > ymd();
      pane.innerHTML = `<div class="ed-top">${back}<span class="spacer"></span></div><div class="empty" style="margin-top:10vh">${icon('book')}<h3>${esc(longDate(d))}</h3><p>${future ? 'This day hasn’t happened yet — you can still plan ahead.' : 'No entry for this day.'}</p><button class="btn primary" data-act="writeDiary">${icon('pen')} ${d === ymd() ? 'Start today’s entry' : 'Write an entry'}</button></div>`;
    } else pane.innerHTML = `<div class="empty" style="margin-top:14vh">${icon('notes')}<h3>No note selected</h3><p>Pick a note from the list or start a new one.</p><button class="btn primary" data-act="newNote">${icon('plus')} New note</button></div>`;
    return;
  }
  if (n.deleted) {
    pane.innerHTML = `<div class="ed-top">${back}<span class="badge warn">${icon('trash')} In Trash</span><span class="spacer"></span>
      <button class="btn sm" data-act="restoreNote">${icon('restore')} Restore</button>
      <button class="btn sm danger" data-act="destroyNote" style="margin-left:6px">Delete forever</button></div>
      <div class="ed-scroll"><div class="ed-inner"><h1 class="ed-title" style="margin-bottom:18px">${esc(noteTitle(n))}</h1><div class="md">${isLockedPriv(n) ? '<p class="muted">Private entry.</p>' : renderMd(n.body, { readonly: true })}</div></div></div>`;
    return;
  }
  if (isLockedPriv(n)) {
    pane.innerHTML = `<div class="ed-top">${back}<span class="spacer"></span><button class="icon-btn" data-act="noteMenu" aria-label="More">${icon('more')}</button></div>
      <div class="locked-note">${icon('lock')}<h3>${esc(noteTitle(n))}</h3><p class="muted">This ${n.type === 'diary' ? 'entry' : 'note'} is private. Enter its password to read it.</p>
      <form id="privForm"><input class="input" type="password" id="privPw" placeholder="Entry password" autocomplete="off" aria-label="Entry password"><div class="err-text" id="privErr"></div><button class="btn primary block" type="submit">Unlock entry</button></form></div>`;
    $('#privForm').onsubmit = async e => {
      e.preventDefault(); const pw = $('#privPw').value; if (!pw) return;
      try { await unlockPrivate(n, pw); renderEditor(); } catch (err) { $('#privErr').textContent = 'Wrong password.'; }
    };
    setTimeout(() => $('#privPw') && $('#privPw').focus(), 30);
    return;
  }
  const st = S.settings, isD = n.type === 'diary';
  pane.innerHTML = `
  <div class="ed-top">${back}<div class="ed-status js-status"></div><span class="spacer"></span>
    <button class="icon-btn${n.pinned ? ' on' : ''}" data-act="togglePin" title="Pin to top" aria-label="Pin" aria-pressed="${n.pinned}">${icon('pin', 'fillable')}</button>
    <button class="icon-btn${n.fav ? ' on' : ''}" data-act="toggleFav" title="Favorite" aria-label="Favorite" aria-pressed="${n.fav}">${icon('star', 'fillable')}</button>
    <button class="icon-btn${UI.preview ? ' on' : ''}" data-act="togglePreview" title="${UI.preview ? 'Edit' : 'Read mode'} (Ctrl+E)" aria-label="Toggle read mode">${icon(UI.preview ? 'edit' : 'eye')}</button>
    <button class="icon-btn hide-sm${UI.focus ? ' on' : ''}" data-act="toggleFocus" title="Focus mode (Alt+F)" aria-label="Focus mode">${icon('focus')}</button>
    <button class="icon-btn" data-act="history" title="Version history" aria-label="Version history">${icon('clock')}</button>
    <button class="icon-btn" data-act="noteMenu" title="More" aria-label="More options">${icon('more')}</button>
  </div>
  ${st.toolbar && !UI.preview ? toolbarHTML(isD) : ''}
  <div class="ed-scroll" id="edScroll"><div class="ed-inner">
    ${isD ? `<div class="ed-date">${esc(longDate(n.date))}</div>` : ''}
    <input class="ed-title" id="edTitle" placeholder="${isD ? 'Give this day a title (optional)' : 'Title'}" value="${esc(n.title)}" ${UI.preview ? 'readonly' : ''} aria-label="Title">
    <div class="ed-meta">${isD ? '' : `${icon('folder')}<select id="edNb" aria-label="Notebook"><option value="">No notebook</option>${S.notebooks.map(b => `<option value="${b.id}"${b.id === n.notebookId ? ' selected' : ''}>${esc(b.name)}</option>`).join('')}<option value="__new">+ New notebook…</option></select>`}${tagsHTML(n)}</div>
    ${isD && st.mood ? moodHTML(n) : ''}
    ${isD && st.prompts && !n.body.trim() && !UI.preview ? `<div class="prompt-box" id="promptBox">${icon('bulb')}<span id="promptText" style="flex:1">${esc(PROMPTS[promptIdx])}</span><button class="btn sm" data-act="usePrompt">Use</button><button class="icon-btn" data-act="nextPrompt" title="Another prompt" aria-label="Another prompt">${icon('restore')}</button></div>` : ''}
    <textarea id="edText" class="ed-text${UI.preview ? ' hidden' : ''}" spellcheck="${st.spell}" placeholder="${isD ? 'How was your day?' : 'Start writing…'}" aria-label="Note text">${esc(n.body)}</textarea>
    <div id="edPreview" class="md${UI.preview ? '' : ' hidden'}"></div>
    ${st.power ? '<div id="backlinks"></div>' : ''}
  </div></div>
  <div class="ed-foot"><span id="edCount"></span><span class="hide-sm">Created ${fmtDate(n.created)}</span><span class="hide-sm">Edited ${rel(n.updated)}</span><span class="spacer"></span>
    ${n.priv ? `<span class="badge">${icon('lock')} Private entry</span>` : ''}${vault.enc ? `<span class="badge">${icon('shield')} Encrypted</span>` : ''}</div>`;
  setSaveState(saveState);
  bindEditor(n);
}
function bindEditor(n) {
  const ta = $('#edText'), ti = $('#edTitle');
  ti.addEventListener('input', () => { n.title = ti.value; touch(n); });
  ti.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); ta.focus(); ta.setSelectionRange(0, 0); } });
  ta.addEventListener('input', () => {
    n.body = ta.value; autoGrow(ta); updateCount(n); touch(n); suggestTags(n); centerCaret();
    const pb = $('#promptBox'); if (pb && n.body.trim()) pb.remove();
  });
  ta.addEventListener('keydown', e => editorKeys(e, ta));
  ['click', 'keyup'].forEach(ev => ta.addEventListener(ev, e => { if (ev === 'click' || /Arrow|Page|Home|End/.test(e.key)) centerCaret(); }));
  const nb = $('#edNb');
  if (nb) nb.addEventListener('change', async () => {
    if (nb.value === '__new') {
      const name = await promptModal({ title: 'New notebook', label: 'Notebook name', ok: 'Create' });
      if (name && name.trim()) { const b = { id: uid(), name: name.trim() }; S.notebooks.push(b); n.notebookId = b.id; }
      touch(n); renderEditor(); renderSidebar(); return;
    }
    n.notebookId = nb.value || null; touch(n); renderSidebar();
  });
  bindTagInput(n);
  if (UI.preview) renderPreview(n);
  if (S.settings.power) renderBacklinks(n);
  updateCount(n);
  requestAnimationFrame(() => autoGrow(ta));
}
function bindTagInput(n) {
  const inp = $('#tagInput'); if (!inp) return;
  const add = (refocus = true) => {
    const vals = inp.value.split(/[,\s]+/).map(t => t.replace(/^#/, '').trim().toLowerCase()).filter(Boolean);
    if (!vals.length) return;
    vals.forEach(v => { if (!n.tags.includes(v)) n.tags.push(v); });
    inp.value = ''; touch(n); refreshTags(n); if (refocus) $('#tagInput').focus();
  };
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); }
    else if (e.key === 'Backspace' && !inp.value && n.tags.length) { n.tags.pop(); touch(n); refreshTags(n); $('#tagInput').focus(); }
  });
  inp.addEventListener('change', () => { if (allTags().includes(inp.value.trim().toLowerCase())) add(); });
  inp.addEventListener('blur', () => { if (inp.value.trim()) add(false); });   // don't steal focus back
  suggestTags(n);
}
export function refreshTags(n) { const c = $('#tagChips'); if (!c) return; c.outerHTML = tagsHTML(n); bindTagInput(n); }
const suggestTags = debounce(n => {
  const box = $('#tagSugg'); if (!box || UI.preview) return;
  const text = (n.title + ' ' + n.body).toLowerCase();
  const s = allTags().filter(t => !n.tags.includes(t) && t.length > 2 && new RegExp('(^|[^\\p{L}])' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^\\p{L}]|$)', 'u').test(text)).slice(0, 3);
  box.innerHTML = s.map(t => `<span class="chip sugg" role="button" tabindex="0" data-act="addTagS" data-tag="${esc(t)}" title="Suggested tag">+ #${esc(t)}</span>`).join('');
}, 600);
export function touch(n) { n.updated = Date.now(); snapshotHistory(n); scheduleSave(); refreshSide(); }
function updateCount(n) {
  const el = $('#edCount'); if (!el) return;
  const w = wordCount(n.body);
  el.textContent = `${w.toLocaleString()} word${w === 1 ? '' : 's'} · ${Math.max(1, Math.round(w / 220))} min read`;
}
export function autoGrow(ta) {
  if (!ta || ta.classList.contains('hidden')) return;
  const sc = $('#edScroll'), top = sc ? sc.scrollTop : 0;
  ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px';
  if (sc) sc.scrollTop = top;
}
let mirror = null;
function caretTop(ta) {
  if (!mirror) { mirror = document.createElement('div'); mirror.setAttribute('aria-hidden', 'true'); document.body.appendChild(mirror); }
  const cs = getComputedStyle(ta);
  mirror.style.cssText = `position:absolute;visibility:hidden;top:0;left:-9999px;white-space:pre-wrap;overflow-wrap:break-word;word-wrap:break-word;width:${ta.clientWidth}px;font:${cs.font};line-height:${cs.lineHeight};letter-spacing:${cs.letterSpacing};padding:${cs.padding};`;
  mirror.textContent = ta.value.slice(0, ta.selectionStart);
  const sp = document.createElement('span'); sp.textContent = '​'; mirror.appendChild(sp);
  return sp.offsetTop;
}
function centerCaret() {
  if (!S.settings.typewriter) return;
  const ta = $('#edText'), sc = $('#edScroll'); if (!ta || !sc || ta.classList.contains('hidden')) return;
  const taTop = ta.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop;
  sc.scrollTop = taTop + caretTop(ta) - sc.clientHeight * 0.42;
}
function renderPreview(n) {
  const p = $('#edPreview'); if (!p) return;
  p.innerHTML = renderMd(n.body, { wiki: S.settings.power }) || '<p class="muted">Nothing written yet.</p>';
  p.onchange = e => {
    const cb = e.target.closest('input[type=checkbox][data-line]'); if (!cb) return;
    const lines = n.body.split('\n'), i = +cb.dataset.line;
    lines[i] = lines[i].replace(/\[( |x|X)\]/, cb.checked ? '[x]' : '[ ]');
    n.body = lines.join('\n'); $('#edText').value = n.body; touch(n); renderPreview(n);
  };
  p.onclick = e => { const a = e.target.closest('a.wikilink'); if (a) { e.preventDefault(); openByTitle(a.dataset.title); } };
}
function renderBacklinks(n) {
  const box = $('#backlinks'); if (!box) return;
  const t = (n.title || '').trim().toLowerCase();
  const links = t ? live().filter(x => x.id !== n.id && !isLockedPriv(x) && x.body.toLowerCase().includes('[[' + t + ']]')) : [];
  box.innerHTML = links.length ? `<div class="backlinks"><h4>Linked from</h4>${links.map(x => `<button data-act="openNote" data-id="${x.id}">↳ ${esc(noteTitle(x))}</button>`).join('')}</div>` : '';
}

export function touchMeta(n) { n.updated = Date.now(); scheduleSave(); refreshSide(); }
export function togglePreview() {
  const n = cur(); if (!n || n.deleted || isLockedPriv(n)) return;
  UI.preview = !UI.preview; renderEditor();
  if (!UI.preview) setTimeout(() => $('#edText') && $('#edText').focus(), 20);
}
export function toggleFocus() {
  UI.focus = !UI.focus; $('#app').classList.toggle('focus', UI.focus);
  $$('[data-act=toggleFocus]').forEach(b => b.classList.toggle('on', UI.focus));
  if (UI.focus && UI.view === 'home') { toast('Open a note to use focus mode'); UI.focus = false; $('#app').classList.remove('focus'); }
  setTimeout(() => autoGrow($('#edText')), 30);
}
