/* Printing, single-note HTML export and the printable diary book. */
import { $, esc, pad, longDate, safeName, download } from '../lib/util.js';
import { icon } from '../lib/icons.js';
import { renderMd } from '../lib/markdown.js';
import { MOODS, ENERGY } from '../data/constants.js';
import { S, live, noteTitle, isLockedPriv } from '../data/state.js';
import { modal, closeModal } from './modal.js';
import { toast } from './toast.js';

export const PRINT_CSS = `body{font-family:"Iowan Old Style","Palatino Linotype",Georgia,serif;color:#1f2a33;max-width:680px;margin:40px auto;padding:0 24px;line-height:1.65;font-size:12pt}
h1,h2,h3,h4{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;line-height:1.3}
.cover{min-height:88vh;display:flex;flex-direction:column;justify-content:center;text-align:center;page-break-after:always}
.cover h1{font-size:34pt;margin:0 0 8px}.cover p{color:#6b7680}
.entry{margin-bottom:34px}.entry+.entry{border-top:1px solid #ddd;padding-top:26px}
.date{font:600 9.5pt system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#2f6b5e}
.mood{font:9.5pt system-ui,sans-serif;color:#6b7680}
img{max-width:100%;border-radius:6px}blockquote{border-left:3px solid #2f6b5e;margin:0 0 1em;padding-left:14px;color:#555}
code{background:#f2f2f2;padding:1px 4px;border-radius:4px}pre{background:#f6f6f6;padding:10px;white-space:pre-wrap}
li.task{list-style:none;margin-left:-1.2em}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:4px 8px}
mark{background:#fde9a8}@media print{body{margin:0 auto}}`;
export function noteHTMLDoc(title, inner, autoPrint) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${PRINT_CSS}</style></head><body>${inner}${autoPrint ? '<script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script>' : ''}</body></html>`;
}
export function printHTML(title, inner) {
  const html = noteHTMLDoc(title, inner, true);
  const w = window.open('', '_blank');
  if (!w) { download(safeName(title) + '.html', html, 'text/html'); toast('Pop-up blocked — downloaded as HTML. Open it and print to PDF.'); return; }
  w.document.open(); w.document.write(html); w.document.close();
}
export function entryHTML(n) {
  const body = isLockedPriv(n) ? '<p><i>Private entry — not included.</i></p>' : renderMd(n.body, { readonly: true });
  if (n.type === 'diary') return `<div class="entry"><div class="date">${esc(longDate(n.date))}</div>${n.title ? `<h2>${esc(n.title)}</h2>` : ''}${n.mood ? `<div class="mood">Mood: ${MOODS[n.mood].n}${n.energy != null ? ' · Energy: ' + ENERGY[n.energy] : ''}</div>` : ''}${body}</div>`;
  return `<h1>${esc(noteTitle(n))}</h1>${body}`;
}
export function openDiaryBook() {
  const entries = live().filter(n => n.type === 'diary');
  if (!entries.length) { toast('Write a diary entry first.'); return; }
  const years = [...new Set(entries.map(n => n.date.slice(0, 4)))].sort().reverse();
  const months = [...Array(12)].map((_, i) => `<option value="${pad(i + 1)}">${new Date(2000, i, 1).toLocaleDateString(undefined, { month: 'long' })}</option>`).join('');
  modal({
    title: 'Diary book', body: `<p class="muted" style="margin-top:0">Create a printable book of your entries. In the print window choose “Save as PDF”.</p>
    <div class="field"><label for="dbY">Year</label><select class="input" id="dbY">${years.map(y => `<option>${y}</option>`).join('')}</select></div>
    <div class="field"><label for="dbM">Month</label><select class="input" id="dbM"><option value="">Whole year</option>${months}</select></div>`,
    foot: `<button class="btn" data-act="closeModal">Cancel</button><button class="btn primary" id="dbGo">${icon('print')} Create book</button>`
  });
  $('#dbGo').onclick = () => {
    const y = $('#dbY').value, m = $('#dbM').value, pre = m ? `${y}-${m}` : y;
    const list = entries.filter(n => n.date.startsWith(pre)).sort((a, b) => a.date.localeCompare(b.date));
    if (!list.length) { toast('No entries in that period.'); return; }
    const label = m ? new Date(+y, +m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : y;
    closeModal();
    printHTML(`Diary — ${label}`, `<div class="cover"><p>J Notes</p><h1>My Diary</h1><p>${esc(label)} · ${list.length} entr${list.length === 1 ? 'y' : 'ies'}</p>${S.settings.name ? `<p>${esc(S.settings.name)}</p>` : ''}</div>${list.map(entryHTML).join('')}`);
  };
}
