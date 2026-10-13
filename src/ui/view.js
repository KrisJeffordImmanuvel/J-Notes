/* The single screen: top bar, formatting toolbar, find bar, the note and its footer. */
import { $, $$, esc, rel, wordCount } from '../lib/util.js';
import { icon } from '../lib/icons.js';
import { renderMd } from '../lib/markdown.js';
import { prefs, THEMEKEY } from '../lib/storage.js';
import { S, UI, vault, note, snapshotHistory } from '../data/state.js';
import { scheduleSave, saveState, setSaveState } from '../data/persist.js';
import { editorKeys } from './format.js';
import { findRefresh, isFindOpen } from './find.js';

export function render() {
  if (!S) return;
  applySettings(); renderView();
  $('#app').classList.toggle('focus', !!UI.focus);
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

const TB = [['h', 'Heading', 'heading'], ['bold', 'Bold (Ctrl+B)', 'bold'], ['italic', 'Italic (Ctrl+I)', 'italic'], ['strike', 'Strikethrough', 'strike'], '|',
['list', 'Bullet list', 'ul'], ['olist', 'Numbered list', 'ol'], ['check', 'Checklist', 'task'], '|', ['quote', 'Quote', 'quote'], ['code', 'Code', 'code'], ['link', 'Link', 'link'], ['image', 'Insert image', 'image'], ['hr', 'Divider', 'hr']];
const toolbarHTML = () => `<div class="toolbar" role="toolbar" aria-label="Formatting">${TB.map(t => t === '|' ? '<span class="sep"></span>' : `<button class="icon-btn" data-act="fmt" data-f="${t[2]}" title="${t[1]}" aria-label="${t[1]}">${icon(t[0])}</button>`).join('')}</div>`;

function renderView() {
  const n = note(), st = S.settings, findWasOpen = isFindOpen();
  $('#main').innerHTML = `
  <header class="bar">
    <div class="logo keep-focus">J</div><span class="name">J Notes</span>
    <div class="ed-status js-status"></div><span class="spacer"></span>
    <button class="icon-btn" data-act="find" title="Find in note (Ctrl+F)" aria-label="Find in note">${icon('search')}</button>
    <button class="icon-btn${UI.preview ? ' on' : ''}" data-act="togglePreview" title="${UI.preview ? 'Edit' : 'Read mode'} (Ctrl+E)" aria-label="${UI.preview ? 'Edit' : 'Read mode'}">${icon(UI.preview ? 'edit' : 'eye')}</button>
    <button class="icon-btn hide-sm${UI.focus ? ' on' : ''}" data-act="toggleFocus" title="Focus mode (Alt+F)" aria-label="Focus mode">${icon('focus')}</button>
    <button class="icon-btn" data-act="history" title="Version history" aria-label="Version history">${icon('clock')}</button>
    <button class="icon-btn" data-act="settings" title="Settings" aria-label="Settings">${icon('gear')}</button>
    <button class="icon-btn keep-focus" data-act="lock" title="Lock now (Alt+L)" aria-label="Lock now">${icon('lock')}</button>
  </header>
  ${st.toolbar && !UI.preview ? toolbarHTML() : ''}
  <div class="findbar${findWasOpen ? '' : ' hidden'}" id="findBar" role="search">
    <input class="input" id="findIn" placeholder="Find in note" aria-label="Find in note" autocomplete="off">
    <span class="count" id="findCount" aria-live="polite"></span>
    <button class="icon-btn" data-act="findPrev" title="Previous (Shift+Enter)" aria-label="Previous match">${icon('left')}</button>
    <button class="icon-btn" data-act="findNext" title="Next (Enter)" aria-label="Next match">${icon('right')}</button>
    <button class="icon-btn" data-act="findClose" title="Close (Esc)" aria-label="Close find">${icon('x')}</button>
  </div>
  <div class="ed-scroll" id="edScroll"><div class="ed-inner">
    <div class="ed-wrap${UI.preview ? ' hidden' : ''}"><div class="ed-backdrop" id="edBackdrop" aria-hidden="true"></div>
      <textarea id="edText" class="ed-text" spellcheck="${st.spell}" placeholder="Write anything…" aria-label="Your note">${esc(n.body)}</textarea></div>
    <div id="edPreview" class="md${UI.preview ? '' : ' hidden'}"></div>
  </div></div>
  <footer class="ed-foot"><span id="edCount"></span><span class="hide-sm" id="edEdited"></span><span class="spacer"></span>
    ${vault.enc ? `<span class="badge">${icon('shield')} Encrypted</span>` : ''}</footer>`;
  setSaveState(saveState);
  bindEditor(n);
  if (findWasOpen) findRefresh();
}

function bindEditor(n) {
  const ta = $('#edText');
  ta.addEventListener('input', () => {
    n.body = ta.value; autoGrow(ta); updateFoot(n); touch(n); centerCaret();
    if (isFindOpen()) findRefresh(false);
  });
  ta.addEventListener('keydown', e => editorKeys(e, ta));
  ['click', 'keyup'].forEach(ev => ta.addEventListener(ev, e => { if (ev === 'click' || /Arrow|Page|Home|End/.test(e.key)) centerCaret(); }));
  if (UI.preview) renderPreview(n);
  updateFoot(n);
  requestAnimationFrame(() => autoGrow(ta));
}

export function touch(n) { n.updated = Date.now(); snapshotHistory(n); scheduleSave(); }
function updateFoot(n) {
  const w = wordCount(n.body), c = $('#edCount'), e = $('#edEdited');
  if (c) c.textContent = `${w.toLocaleString()} word${w === 1 ? '' : 's'} · ${Math.max(1, Math.round(w / 220))} min read`;
  if (e) e.textContent = `Edited ${rel(n.updated)}`;
}
export function autoGrow(ta) {
  if (!ta || ta.closest('.hidden')) return;
  const sc = $('#edScroll'), top = sc ? sc.scrollTop : 0;
  ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px';
  if (sc) sc.scrollTop = top;
}

let mirror = null;
/** Pixel offset of a text position inside the textarea (used by typewriter mode). */
function caretTop(ta, pos) {
  if (!mirror) { mirror = document.createElement('div'); mirror.setAttribute('aria-hidden', 'true'); document.body.appendChild(mirror); }
  const cs = getComputedStyle(ta);
  mirror.style.cssText = `position:absolute;visibility:hidden;top:0;left:-9999px;white-space:pre-wrap;overflow-wrap:break-word;word-wrap:break-word;width:${ta.clientWidth}px;font:${cs.font};line-height:${cs.lineHeight};letter-spacing:${cs.letterSpacing};padding:${cs.padding};`;
  mirror.textContent = ta.value.slice(0, pos);
  const sp = document.createElement('span'); sp.textContent = '​'; mirror.appendChild(sp);
  return sp.offsetTop;
}
function centerCaret() {
  if (!S.settings.typewriter) return;
  const ta = $('#edText'), sc = $('#edScroll'); if (!ta || !sc || ta.closest('.hidden')) return;
  const taTop = ta.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop;
  sc.scrollTop = taTop + caretTop(ta, ta.selectionStart) - sc.clientHeight * 0.42;
}

function renderPreview(n) {
  const p = $('#edPreview'); if (!p) return;
  p.innerHTML = renderMd(n.body) || '<p class="muted">Nothing written yet.</p>';
  p.onchange = e => {   // tick checklist items in read mode
    const cb = e.target.closest('input[type=checkbox][data-line]'); if (!cb) return;
    const lines = n.body.split('\n'), i = +cb.dataset.line;
    lines[i] = lines[i].replace(/\[( |x|X)\]/, cb.checked ? '[x]' : '[ ]');
    n.body = lines.join('\n'); $('#edText').value = n.body; touch(n); renderPreview(n);
  };
}

export function togglePreview(on = !UI.preview) {
  if (UI.preview === on) return;
  UI.preview = on; renderView();
  if (!UI.preview) setTimeout(() => $('#edText') && $('#edText').focus(), 20);
}
export function toggleFocus() {
  UI.focus = !UI.focus; $('#app').classList.toggle('focus', UI.focus);
  $$('[data-act=toggleFocus]').forEach(b => b.classList.toggle('on', UI.focus));
  setTimeout(() => autoGrow($('#edText')), 30);
}
