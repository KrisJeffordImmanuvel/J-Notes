import { describe, it, expect } from 'vitest';
import { frontMatter, parseFrontMatter, noteFromMarkdown, mergeData } from '../../src/data/formats.js';
import { newNote } from '../../src/data/state.js';

describe('front-matter', () => {
  it('round-trips note metadata', () => {
    const notebooks = [{ id: 'nb1', name: 'Work "stuff"' }];
    const n = newNote({ title: 'Plan: Q3', notebookId: 'nb1', tags: ['a', 'b c'], pinned: true, fav: true });
    const md = frontMatter(n, notebooks) + 'Body text\n';
    const { meta, body } = parseFrontMatter(md);
    expect(meta.title).toBe('Plan: Q3');
    expect(meta.id).toBe(n.id);
    expect(meta.tags).toEqual(['a', 'b c']);
    expect(meta.pinned).toBe('true');
    expect(meta.favorite).toBe('true');
    expect(body.trim()).toBe('Body text');
  });

  it('leaves files without front-matter alone', () => {
    expect(parseFrontMatter('# Just text')).toEqual({ meta: {}, body: '# Just text' });
  });
});

describe('noteFromMarkdown', () => {
  it('imports a diary entry with mood', () => {
    const n = noteFromMarkdown('x.md', '---\ntype: diary\ndate: 2025-03-04\nmood: good\ntags: [#Travel, travel]\n---\n\nWent hiking.', 0);
    expect(n.type).toBe('diary');
    expect(n.date).toBe('2025-03-04');
    expect(n.mood).toBe(4);
    expect(n.tags).toEqual(['travel']);
    expect(n.body).toBe('Went hiking.');
  });

  it('uses the file name as title and resolves notebooks', () => {
    const n = noteFromMarkdown('Groceries.md', '---\nnotebook: Home\n---\n- milk', 1000, name => name === 'Home' ? 'nb-home' : null);
    expect(n.title).toBe('Groceries');
    expect(n.notebookId).toBe('nb-home');
    expect(n.created).toBe(1000);
  });
});

describe('mergeData', () => {
  const base = () => ({ notebooks: [{ id: 'a', name: 'A' }], attachments: {}, notes: [newNote({ id: 'n1', title: 'old', updated: 100 })] });

  it('adds new notes and keeps newer versions only', () => {
    const t = base();
    const r = mergeData(t, {
      notebooks: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], attachments: { img: { data: 'x' } },
      notes: [newNote({ id: 'n1', title: 'new', updated: 200 }), newNote({ id: 'n2', title: 'extra' })]
    });
    expect(r).toEqual({ added: 1, updated: 1 });
    expect(t.notes.find(n => n.id === 'n1').title).toBe('new');
    expect(t.notebooks).toHaveLength(2);
    expect(t.attachments.img).toBeTruthy();
  });

  it('never replaces a note with an older copy or an open private note', () => {
    const t = base();
    expect(mergeData(t, { notebooks: [], attachments: {}, notes: [newNote({ id: 'n1', title: 'older', updated: 50 })] })).toEqual({ added: 0, updated: 0 });
    expect(mergeData(t, { notebooks: [], attachments: {}, notes: [newNote({ id: 'n1', title: 'newer', updated: 500 })] }, { n1: true })).toEqual({ added: 0, updated: 0 });
    expect(t.notes[0].title).toBe('old');
  });
});
