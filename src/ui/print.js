/* Printing / saving the note as PDF. */
import { esc, safeName, download } from '../lib/util.js';
import { renderMd } from '../lib/markdown.js';
import { note } from '../data/state.js';
import { toast } from './toast.js';

export const PRINT_CSS = `body{font-family:"Iowan Old Style","Palatino Linotype",Georgia,serif;color:#1f2a33;max-width:680px;margin:40px auto;padding:0 24px;line-height:1.65;font-size:12pt}
h1,h2,h3,h4{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;line-height:1.3}
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
/** Print the note (the browser's print dialog can save it as PDF). */
export const printNote = () => printHTML('J Notes', renderMd(note().body, { readonly: true }));
