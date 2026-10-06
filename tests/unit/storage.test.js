import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

function memoryLocalStorage(initial = {}) {
  const m = new Map(Object.entries(initial));
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: k => { m.delete(k); },
    _map: m
  };
}

async function freshStore() {
  vi.resetModules();
  return import('../../src/lib/storage.js');
}

describe('storage', () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
    globalThis.localStorage = memoryLocalStorage();
  });

  it('uses IndexedDB and persists across reloads', async () => {
    let m = await freshStore();
    expect(await m.initStore()).toBe('indexeddb');
    expect(await m.store.set(m.KEY, '{"v":1}')).toBe(true);
    m = await freshStore();
    await m.initStore();
    expect(m.store.get(m.KEY)).toBe('{"v":1}');
  });

  it('migrates data from localStorage and removes the old copy', async () => {
    globalThis.localStorage = memoryLocalStorage({ 'jnotes:v1': 'old-record', 'jnotes:snapshots': '[]', 'jnotes:theme': 'dark' });
    const m = await freshStore();
    await m.initStore();
    expect(m.store.get(m.KEY)).toBe('old-record');
    expect(m.store.get(m.SNAP)).toBe('[]');
    expect(localStorage.getItem('jnotes:v1')).toBeNull();
    expect(localStorage.getItem('jnotes:theme')).toBe('dark');   // preferences stay in localStorage
    const again = await freshStore();
    await again.initStore();
    expect(again.store.get(again.KEY)).toBe('old-record');
  });

  it('falls back to localStorage when IndexedDB is unavailable', async () => {
    delete globalThis.indexedDB;
    const m = await freshStore();
    expect(await m.initStore()).toBe('localstorage');
    expect(await m.store.set(m.KEY, 'abc')).toBe(true);
    expect(localStorage.getItem(m.KEY)).toBe('abc');
    expect(m.store.structured).toBe(false);
  });

  it('reports failure and keeps the previous value when a write fails', async () => {
    delete globalThis.indexedDB;
    const m = await freshStore();
    await m.initStore();
    await m.store.set(m.KEY, 'first');
    localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
    expect(await m.store.set(m.KEY, 'second')).toBe(false);
    expect(m.store.get(m.KEY)).toBe('first');
  });

  it('deletes values', async () => {
    const m = await freshStore();
    await m.initStore();
    await m.store.set(m.SNAP, 'x');
    await m.store.del(m.SNAP);
    expect(m.store.get(m.SNAP)).toBeNull();
    const again = await freshStore();
    await again.initStore();
    expect(again.store.get(again.SNAP)).toBeNull();
  });
});
