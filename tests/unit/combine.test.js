import { describe, it, expect } from 'vitest';
import { combineNotes, needsCombine } from '../../src/data/combine.js';
import { defaultData } from '../../src/data/state.js';

const v1 = (notes, attachments = {}) => ({ v: 1, settings: { theme: 'dark' }, notebooks: [], notes, attachments });
const n = (over) => ({ id: Math.random().toString(36).slice(2), type: 'note', title: '', body: '', tags: [], created: 0, updated: 0, deleted: null, history: [], ...over });

describe('combining old multi-note data into one note', () => {
  it('only touches old-format data', () => {
    expect(needsCombine(defaultData())).toBe(false);
    expect(needsCombine(v1([]))).toBe(true);
  });

  it('puts notes and diary entries in date order, each under a heading', () => {
    const { data, count } = combineNotes(v1([
      n({ title: 'Shopping', body: '- milk', created: Date.parse('2026-03-01'), tags: ['home'] }),
      n({ type: 'diary', date: '2026-02-10', title: 'Snow day', body: 'It snowed.', mood: 5, energy: 0 }),
      n({ title: 'Ideas', body: 'Build a boat', created: Date.parse('2026-04-01') })
    ]));
    expect(count).toBe(3);
    expect(data.v).toBe(2);
    expect(data.notes).toHaveLength(1);
    const body = data.notes[0].body;
    expect(body.indexOf('Snow day')).toBeLessThan(body.indexOf('## Shopping'));
    expect(body.indexOf('## Shopping')).toBeLessThan(body.indexOf('## Ideas'));
    expect(body).toContain('*Mood: Great · Energy: Low*');
    expect(body).toContain('*#home*');
    expect(body).toContain('\n\n---\n\n');
    expect(data.settings.theme).toBe('dark');
  });

  it('leaves out notes in the Trash and the untouched sample note', () => {
    const { data, count } = combineNotes(v1([
      n({ title: 'Welcome to J Notes', body: 'J Notes is a calm, private place for your notes and your diary.' }),
      n({ title: 'Gone', body: 'deleted', deleted: 1 }),
      n({ title: 'Kept', body: 'yes', created: 5 })
    ]));
    expect(count).toBe(1);
    expect(data.notes[0].body).toContain('## Kept');
    expect(data.notes[0].body).not.toContain('Welcome');
    expect(data.notes[0].body).not.toContain('deleted');
  });

  it('a single untitled note is taken over as it is, with its history', () => {
    const { data } = combineNotes(v1([n({ body: 'just text', history: [{ t: 1, title: '', body: 'just' }] })]));
    expect(data.notes[0].body).toBe('just text');
    expect(data.notes[0].history).toEqual([{ t: 1, body: 'just' }]);
  });

  it('keeps only the images the combined note uses', () => {
    const { data } = combineNotes(v1([n({ title: 'Pic', body: '![a](attachment:abc)' })], { abc: { data: 'data:image/png;base64,AA' }, zzz: { data: 'x' } }));
    expect(Object.keys(data.attachments)).toEqual(['abc']);
  });

  it('notes a password-protected entry instead of losing it silently', () => {
    const { data } = combineNotes(v1([n({ title: 'Secret', priv: { salt: 's', iv: 'i', ct: 'c' } })]));
    expect(data.notes[0].body).toContain('password-protected entry');
  });

  it('an empty old install becomes an empty note', () => {
    const { data, count } = combineNotes(v1([]));
    expect(count).toBe(0);
    expect(data.notes[0].body).toBe('');
  });
});
