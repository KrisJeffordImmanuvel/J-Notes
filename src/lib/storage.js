/* Persistent key–value storage.
 *
 * Data lives in IndexedDB (room for hundreds of MB — photos and snapshots no longer
 * fight over localStorage's ~5 MB). Everything is loaded into memory once at start-up
 * so reads stay synchronous; writes go to memory immediately and to disk asynchronously.
 *
 * If IndexedDB is unavailable the store falls back to localStorage, and if that is
 * blocked too it keeps data in memory only (the app warns the user).
 *
 * Data written by older versions to localStorage is moved into IndexedDB on first run.
 */

export const KEY = 'jnotes:v1', SNAP = 'jnotes:snapshots', THEMEKEY = 'jnotes:theme', FOLDERKEY = 'jnotes:folder';
const MIGRATE = [KEY, SNAP];
const DB_NAME = 'jnotes', OS = 'kv';

const mem = new Map();
let db = null;
let mode = 'memory'; // 'indexeddb' | 'localstorage' | 'memory'

/* ---------- localStorage (safe wrappers) ---------- */
const ls = {
  get(k) { try { return globalThis.localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { globalThis.localStorage.setItem(k, v); return true; } catch (e) { return false; } },
  del(k) { try { globalThis.localStorage.removeItem(k); } catch (e) { } },
  ok() { try { localStorage.setItem('jnotes:t', '1'); localStorage.removeItem('jnotes:t'); return true; } catch (e) { return false; } }
};
/** Small per-device preferences that must be readable before the database opens (e.g. theme). */
export const prefs = { get: ls.get, set: ls.set, del: ls.del };

/* ---------- IndexedDB ---------- */
function idbOpen() {
  return new Promise((res, rej) => {
    if (!globalThis.indexedDB) return rej(new Error('IndexedDB unavailable'));
    let r;
    try { r = indexedDB.open(DB_NAME, 1); } catch (e) { return rej(e); }
    r.onupgradeneeded = () => r.result.createObjectStore(OS);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
    r.onblocked = () => rej(new Error('IndexedDB blocked'));
  });
}
function idbReq(modeRW, fn) {
  return new Promise((res, rej) => {
    const t = db.transaction(OS, modeRW);
    const rq = fn(t.objectStore(OS));
    t.oncomplete = () => res(rq && rq.result);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error || new Error('Transaction aborted'));
  });
}
function idbLoadAll() {
  return new Promise((res, rej) => {
    const rq = db.transaction(OS).objectStore(OS).openCursor();
    rq.onsuccess = () => { const c = rq.result; if (c) { mem.set(c.key, c.value); c.continue(); } else res(); };
    rq.onerror = () => rej(rq.error);
  });
}

/** Open storage and load everything into memory. Call once before using `store`. */
export async function initStore() {
  mem.clear();
  try {
    db = await idbOpen();
    await idbLoadAll();
    // Whenever IndexedDB works we remove the localStorage copies, so anything still in
    // localStorage was written by an older version (or a fallback session) and is newest.
    for (const k of MIGRATE) {
      const v = ls.get(k);
      if (v == null) continue;
      await idbReq('readwrite', os => os.put(v, k));
      mem.set(k, v);
      ls.del(k);
    }
    mode = 'indexeddb';
  } catch (e) {
    db = null;
    mode = ls.ok() ? 'localstorage' : 'memory';
    for (const k of MIGRATE) { const v = ls.get(k); if (v != null) mem.set(k, v); }
  }
  // Ask the browser not to evict our data under storage pressure (best effort).
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => { }); } catch (e) { }
  return mode;
}

export const store = {
  get mode() { return mode; },
  get(k) { return mem.has(k) ? mem.get(k) : null; },
  /** Resolves to true when the value reached durable storage. */
  async set(k, v) {
    const prev = mem.get(k), had = mem.has(k);
    mem.set(k, v);
    let ok;
    if (mode === 'indexeddb') ok = await idbReq('readwrite', os => os.put(v, k)).then(() => true, () => false);
    else if (mode === 'localstorage') ok = typeof v === 'string' && ls.set(k, v);
    else ok = false;
    if (!ok && mode !== 'memory') { if (had) mem.set(k, prev); else mem.delete(k); }
    return ok;
  },
  async del(k) {
    mem.delete(k);
    if (mode === 'indexeddb') await idbReq('readwrite', os => os.delete(k)).catch(() => { });
    ls.del(k);
  },
  /** Can this backend hold non-string values such as file handles? */
  get structured() { return mode === 'indexeddb'; }
};

/** Approximate usage, for the settings screen. */
export async function storageEstimate() {
  try { if (navigator.storage && navigator.storage.estimate) return await navigator.storage.estimate(); } catch (e) { }
  return null;
}
