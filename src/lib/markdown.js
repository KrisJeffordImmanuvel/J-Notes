/* Small, safe Markdown renderer. All text is escaped first; only whitelisted URLs become links/images. */
import { esc } from './util.js';

let resolveAttachment = () => null;
/** Register how `attachment:<id>` image URLs turn into a data URL. */
export function setAttachmentResolver(fn) { resolveAttachment = fn; }

export function safeUrl(u, img) {
  if (/^(https?:|mailto:|#)/i.test(u)) return true;
  if (/^attachment:[a-z0-9]+$/i.test(u)) return true;
  if (img && /^data:image\//i.test(u)) return true;
  return false;
}

export function inlineMd(s, ctx) {
  s = esc(s);
  const codes = [];
  s = s.replace(/`([^`]+)`/g, (m, c) => { codes.push(c); return '\u0000' + (codes.length - 1) + '\u0000'; });
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (m, a, u) => {
    if (!safeUrl(u, true)) return m;
    let src = u;
    if (u.startsWith('attachment:')) src = resolveAttachment(u.slice(11)) || '';
    return src ? `<img alt="${a}" src="${src}" loading="lazy">` : `<span class="muted">[missing image]</span>`;
  });
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, t, u) => safeUrl(u) ? `<a href="${u}" target="_blank" rel="noopener noreferrer">${t}</a>` : m);
  if (ctx && ctx.wiki) s = s.replace(/\[\[([^\]\n]+)\]\]/g, (m, t) => `<a href="#" class="wikilink" data-title="${t}">${t}</a>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/(^|[^_\w])_([^_\n]+)_(?!\w)/g, '$1<em>$2</em>')
    .replace(/~~([^~]+)~~/g, '<del>$1</del>')
    .replace(/==([^=]+)==/g, '<mark>$1</mark>')
    .replace(/(^|\s)(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g, '$1<a href="$2" target="_blank" rel="noopener noreferrer">$2</a>');
  return s.replace(/\u0000(\d+)\u0000/g, (m, i) => `<code>${codes[i]}</code>`);
}

export function renderMd(src, ctx = {}) {
  const lines = String(src || '').replace(/\r\n?/g, '\n').split('\n');
  let out = '', i = 0, para = [];
  const flush = () => { if (para.length) { out += '<p>' + para.map(l => inlineMd(l, ctx)).join('<br>') + '</p>'; para = []; } };
  const LI = /^(\s*)([-*+]|\d+[.)])\s+(\[( |x|X)\]\s+)?(.*)$/;
  while (i < lines.length) {
    const l = lines[i];
    if (/^```/.test(l)) {
      flush(); const buf = []; i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++; out += `<pre><code>${esc(buf.join('\n'))}</code></pre>`; continue;
    }
    let m;
    if ((m = l.match(/^(#{1,6})\s+(.*)$/))) { flush(); const n = m[1].length; out += `<h${n}>${inlineMd(m[2], ctx)}</h${n}>`; i++; continue; }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(l)) { flush(); out += '<hr>'; i++; continue; }
    if (/^>\s?/.test(l)) {
      flush(); const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ''));
      // checkboxes inside quotes would point at the wrong line, so quotes render read-only
      out += `<blockquote>${renderMd(buf.join('\n'), { ...ctx, readonly: true })}</blockquote>`; continue;
    }
    if (/^\|.*\|\s*$/.test(l) && i + 1 < lines.length && /^\|?\s*:?-{2,}/.test(lines[i + 1])) {
      flush(); const row = r => r.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      const head = row(l); i += 2; let body = '';
      while (i < lines.length && /^\|.*\|\s*$/.test(lines[i])) { body += '<tr>' + row(lines[i++]).map(c => `<td>${inlineMd(c, ctx)}</td>`).join('') + '</tr>'; }
      out += `<table><thead><tr>${head.map(c => `<th>${inlineMd(c, ctx)}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table>`; continue;
    }
    if ((m = l.match(LI))) {
      flush(); const ordered = /\d/.test(m[2]); const tag = ordered ? 'ol' : 'ul'; let items = '';
      while (i < lines.length && (m = lines[i].match(LI)) && (/\d/.test(m[2]) === ordered)) {
        if (m[3]) {
          const done = m[4] !== ' ';
          items += `<li class="task${done ? ' done' : ''}"><input type="checkbox" data-line="${i}"${done ? ' checked' : ''}${ctx.readonly ? ' disabled' : ''} aria-label="Toggle item"><span>${inlineMd(m[5], ctx)}</span></li>`;
        } else items += `<li>${inlineMd(m[5], ctx)}</li>`;
        i++;
      }
      out += `<${tag}>${items}</${tag}>`; continue;
    }
    if (!l.trim()) { flush(); i++; continue; }
    para.push(l); i++;
  }
  flush();
  return out;
}

/** Markdown → plain text for snippets and search. */
export const plain = s => String(s || '').replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[#>*_`~=\[\]|-]+/g, ' ').replace(/\s+/g, ' ').trim();
