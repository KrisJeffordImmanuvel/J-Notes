/* The "…" menu on a note and the "make private" dialog. */
import { $, uid, safeName, download } from '../lib/util.js';
import { S, cur, newNote, noteTitle, isLockedPriv, privKeys } from '../data/state.js';
import { scheduleSave, persist } from '../data/persist.js';
import { frontMatter } from '../data/formats.js';
import { makePrivate, relockPrivate, removePrivate } from '../data/vault.js';
import { modal, closeModal, openMenu } from './modal.js';
import { toast } from './toast.js';
import { icon } from '../lib/icons.js';
import { openNote, trashNote, refreshSide } from './nav.js';
import { renderEditor } from './editor.js';
import { noteHTMLDoc, entryHTML, printHTML } from './print.js';

export function noteMenu(anchor) {
  const n = cur(); if (!n) return;
  const items = [];
  if (!isLockedPriv(n)) {
    // duplicating a private entry would create an unprotected copy, so it's not offered
    if (!n.priv) items.push({ label: 'Duplicate', icon: 'dup', fn: () => { const c = newNote({ ...JSON.parse(JSON.stringify(n)), id: uid(), title: (n.title || noteTitle(n)) + ' (copy)', type: 'note', date: undefined, mood: undefined, energy: undefined, priv: undefined, history: [], pinned: false, created: Date.now(), updated: Date.now() }); delete c.date; delete c.priv; S.notes.push(c); scheduleSave(); openNote(c.id); } });
    items.push({ label: 'Copy as Markdown', icon: 'copy', fn: () => { navigator.clipboard && navigator.clipboard.writeText(n.body).then(() => toast('Copied'), () => toast('Copy failed')); } });
    items.push('-');
    items.push({ label: 'Export as Markdown (.md)', icon: 'download', fn: () => { const md = n.body.replace(/\(attachment:([a-z0-9]+)\)/gi, (m, id) => S.attachments[id] ? `(${S.attachments[id].data})` : m); download(safeName(noteTitle(n)) + '.md', frontMatter(n, S.notebooks) + md + '\n', 'text/markdown'); } });
    items.push({ label: 'Export as web page (.html)', icon: 'download', fn: () => download(safeName(noteTitle(n)) + '.html', noteHTMLDoc(noteTitle(n), entryHTML(n)), 'text/html') });
    items.push({ label: 'Print / Save as PDF', icon: 'print', fn: () => printHTML(noteTitle(n), entryHTML(n)) });
    items.push('-');
  }
  if (!n.priv) items.push({ label: n.type === 'diary' ? 'Make entry private…' : 'Make note private…', icon: 'lock', fn: () => setupPrivate(n) });
  else if (privKeys[n.id]) {
    items.push({ label: 'Lock entry now', icon: 'lock', fn: async () => { await persist(); relockPrivate(n); renderEditor(); } });
    items.push({ label: 'Remove privacy password', icon: 'unlock', fn: async () => { await removePrivate(n); renderEditor(); refreshSide(); toast('Password removed'); } });
  }
  items.push('-', { label: 'Move to Trash', icon: 'trash', danger: true, fn: () => trashNote(n) });
  openMenu(anchor, items);
}
function setupPrivate(n) {
  modal({
    title: 'Make private', body: `<p class="muted" style="margin-top:0">This ${n.type === 'diary' ? 'entry' : 'note'} will need its own password every time you open it — even when the app is unlocked. It is separate from your PIN.</p>
    <form id="pvForm"><div class="field"><label for="pv1">Password</label><input class="input" type="password" id="pv1" autofocus autocomplete="new-password"></div>
    <div class="field"><label for="pv2">Repeat password</label><input class="input" type="password" id="pv2" autocomplete="new-password"><div class="help" style="color:var(--warn)">If you forget it, this entry cannot be recovered — not even with your recovery key. Version history for it will be cleared.</div></div><div class="err-text" id="pvErr"></div></form>`,
    foot: `<button class="btn" data-act="closeModal">Cancel</button><button class="btn primary" id="pvOk">${icon('lock')} Make private</button>`
  });
  const go = async e => {
    e && e.preventDefault(); const a = $('#pv1').value, b = $('#pv2').value;
    if (a.length < 4) { $('#pvErr').textContent = 'Use at least 4 characters.'; return; }
    if (a !== b) { $('#pvErr').textContent = 'Passwords do not match.'; return; }
    $('#pvOk').disabled = true; await makePrivate(n, a); closeModal(); renderEditor(); refreshSide(); toast('Entry is now private');
  };
  $('#pvForm').onsubmit = go; $('#pvOk').onclick = go;
}
