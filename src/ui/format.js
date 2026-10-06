/* Markdown formatting commands, list continuation and image insertion. */
import { $, uid, fmtDate } from '../lib/util.js';
import { PROMPTS, TEMPLATES } from '../data/constants.js';
import { S } from '../data/state.js';
import { openMenu } from './modal.js';
import { toast } from './toast.js';
import { promptIdx, nextPromptIdx } from './editor.js';

export function insertText(ta, text, s, e) {
  ta.focus();
  if (s != null) ta.setSelectionRange(s, e);
  let ok = false;
  try { ok = document.execCommand('insertText', false, text); } catch (err) { ok = false; }
  if (!ok) { ta.setRangeText(text, ta.selectionStart, ta.selectionEnd, 'end'); ta.dispatchEvent(new Event('input')); }
}
function wrapSel(before, after, ph) {
  const ta = $('#edText'); const s = ta.selectionStart, e = ta.selectionEnd;
  const sel = ta.value.slice(s, e) || ph;
  insertText(ta, before + sel + after, s, e);
  ta.setSelectionRange(s + before.length, s + before.length + sel.length);
}
function prefixLines(fn) {
  const ta = $('#edText'), v = ta.value, s = ta.selectionStart, e = ta.selectionEnd;
  const ls = v.lastIndexOf('\n', s - 1) + 1; let le = v.indexOf('\n', e); if (le < 0) le = v.length;
  const out = v.slice(ls, le).split('\n').map(fn).join('\n');
  insertText(ta, out, ls, le); ta.setSelectionRange(ls + out.length, ls + out.length);
}
function toggleListPrefix(re, make) { prefixLines((l, i) => re.test(l) ? l.replace(re, '') : make(i) + l.replace(/^(\s*)([-*+]\s+(\[[ xX]\]\s+)?|\d+[.)]\s+)/, '$1')); }
export function fmt(f) {
  const ta = $('#edText'); if (!ta || ta.classList.contains('hidden')) { if (f === 'image' || f === 'template' || f === 'prompt') { } else return; }
  switch (f) {
    case 'bold': return wrapSel('**', '**', 'bold text');
    case 'italic': return wrapSel('*', '*', 'italic text');
    case 'strike': return wrapSel('~~', '~~', 'text');
    case 'heading': return prefixLines(l => /^### /.test(l) ? l.slice(4) : /^## /.test(l) ? '#' + l : /^# /.test(l) ? '#' + l : '## ' + l);
    case 'ul': return toggleListPrefix(/^[-*+]\s+(?!\[)/, () => '- ');
    case 'ol': return toggleListPrefix(/^\d+[.)]\s+/, i => `${i + 1}. `);
    case 'task': return toggleListPrefix(/^[-*+]\s+\[[ xX]\]\s+/, () => '- [ ] ');
    case 'quote': return prefixLines(l => /^>\s?/.test(l) ? l.replace(/^>\s?/, '') : '> ' + l);
    case 'code': { const sel = ta.value.slice(ta.selectionStart, ta.selectionEnd); return sel.includes('\n') ? wrapSel('```\n', '\n```', '') : wrapSel('`', '`', 'code'); }
    case 'link': return wrapSel('[', '](https://)', 'link text');
    case 'wiki': return wrapSel('[[', ']]', 'Note title');
    case 'hr': return insertText(ta, '\n\n---\n\n');
    case 'image': return pickImage();
    case 'prompt': return insertPrompt();
    case 'template': return openMenu($('[data-f=template]'), Object.keys(TEMPLATES).map(k => ({ label: k, icon: 'template', fn: () => insertText($('#edText'), TEMPLATES[k].replace(/\{date\}/g, fmtDate(Date.now()))) })));
  }
}
export function insertPrompt() {
  const ta = $('#edText'); const p = PROMPTS[promptIdx]; nextPromptIdx();
  const pre = ta.value && !ta.value.endsWith('\n') ? '\n\n' : '';
  insertText(ta, `${pre}> ${p}\n\n`, ta.value.length, ta.value.length);
}
export function editorKeys(e, ta) {
  const mod = e.ctrlKey || e.metaKey;
  if (mod && !e.shiftKey && !e.altKey) {
    const k = e.key.toLowerCase();
    if (k === 'b') { e.preventDefault(); return fmt('bold'); }
    if (k === 'i') { e.preventDefault(); return fmt('italic'); }
  }
  if (e.key === 'Enter' && !e.shiftKey && !mod && !e.isComposing) {
    const s = ta.selectionStart; if (s !== ta.selectionEnd) return;
    const v = ta.value, ls = v.lastIndexOf('\n', s - 1) + 1, line = v.slice(ls, s);
    const m = line.match(/^(\s*)([-*+]|(\d+)([.)]))\s+(\[[ xX]\]\s+)?/); if (!m) return;
    e.preventDefault();
    if (line.trim() === m[0].trim()) { insertText(ta, '', ls, s); return; }
    insertText(ta, '\n' + m[1] + (m[3] ? (Number(m[3]) + 1) + m[4] : m[2]) + ' ' + (m[5] ? '[ ] ' : ''));
  }
}
function pickImage() {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
  inp.onchange = async () => {
    const f = inp.files[0]; if (!f) return;
    try {
      const data = await resizeImage(f); const id = uid();
      S.attachments[id] = { type: 'image/jpeg', data, name: f.name, t: Date.now() };
      const ta = $('#edText'); if (ta) insertText(ta, `\n![${f.name.replace(/[\[\]()]/g, '')}](attachment:${id})\n`);
    } catch (e) { toast('Could not read that image.'); }
  };
  inp.click();
}
async function resizeImage(f) {
  const url = URL.createObjectURL(f); const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
  const max = 1400, sc = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement('canvas'); c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
  URL.revokeObjectURL(url); return c.toDataURL('image/jpeg', 0.82);
}
