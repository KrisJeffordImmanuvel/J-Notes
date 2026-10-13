/* The PIN lock: the whole note is encrypted with a random key, which is wrapped by the PIN and by the recovery words. */
import { dec, rand } from '../lib/util.js';
import { importRaw, aesDec, wrapWith, unwrapWith, makeRecoveryWords } from '../lib/crypto.js';
import { vault, setVault } from './state.js';
import { persist, snapshotNow } from './persist.js';

export async function enableLock(pin) {
  const raw = rand(32), words = makeRecoveryWords();
  setVault({ enc: true, raw, key: await importRaw(raw), meta: { pin: await wrapWith(pin, raw), rec: await wrapWith(words.join(' '), raw) } });
  await snapshotNow();
  return words;
}
export async function changePin(pin) { vault.meta.pin = await wrapWith(pin, vault.raw); await persist(); }
export async function newRecovery() { const w = makeRecoveryWords(); vault.meta.rec = await wrapWith(w.join(' '), vault.raw); await persist(); return w; }
/** Decrypt a stored record with the PIN (or the recovery words). Throws when the secret is wrong. */
export async function openRecord(rec, secret, viaRecovery) {
  const raw = await unwrapWith(secret, viaRecovery ? rec.rec : rec.pin);
  const key = await importRaw(raw);
  const data = JSON.parse(dec(await aesDec(key, rec.payload)));
  return { raw, key, data };
}
/** Forget the keys (when locking). */
export function wipeKeys() { if (vault.enc) { vault.raw = null; vault.key = null; } }
