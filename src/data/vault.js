/* App lock (whole-vault encryption) and individually private entries. */
import { enc, dec, b64, unb64, rand } from '../lib/util.js';
import { deriveKey, importRaw, aesEnc, aesDec, wrapWith, unwrapWith, makeRecoveryWords } from '../lib/crypto.js';
import { vault, setVault, privKeys } from './state.js';
import { persist, snapshotNow, markSealed } from './persist.js';

/* ---------- vault ---------- */
export async function enableLock(pin) {
  const raw = rand(32), words = makeRecoveryWords();
  setVault({ enc: true, raw, key: await importRaw(raw), meta: { pin: await wrapWith(pin, raw), rec: await wrapWith(words.join(' '), raw) }, lockAt: Date.now() });
  await snapshotNow();
  return words;
}
export async function changePin(pin) { vault.meta.pin = await wrapWith(pin, vault.raw); vault.lockAt = Date.now(); await persist(); }
export async function newRecovery() { const w = makeRecoveryWords(); vault.meta.rec = await wrapWith(w.join(' '), vault.raw); vault.lockAt = Date.now(); await persist(); return w; }
export async function disableLock() { setVault({ enc: false, lockAt: Date.now() }); await persist(); }
/** Decrypt a stored record with the PIN (or the recovery words). Throws when the secret is wrong. */
export async function openRecord(rec, secret, viaRecovery) {
  const raw = await unwrapWith(secret, viaRecovery ? rec.rec : rec.pin);
  const key = await importRaw(raw);
  const data = JSON.parse(dec(await aesDec(key, rec.payload)));
  return { raw, key, data };
}
/** Forget all keys and decrypted data. */
export function wipeKeys() {
  if (vault.enc) { vault.raw = null; vault.key = null; }
  for (const k in privKeys) delete privKeys[k];
}

/* ---------- private (individually locked) entries ---------- */
export async function makePrivate(n, pw) {
  const salt = rand(16); const k = await deriveKey(pw, salt);
  privKeys[n.id] = k; n.priv = { salt: b64(salt), ...(await aesEnc(k, enc(n.body))) }; n.history = []; n.updated = Date.now();
  markSealed(n.id, n.body);
  await persist();
}
export async function unlockPrivate(n, pw) {
  const k = await deriveKey(pw, unb64(n.priv.salt));
  n.body = dec(await aesDec(k, n.priv)); privKeys[n.id] = k;
  markSealed(n.id, n.body);
}
export function relockPrivate(n) { delete privKeys[n.id]; n.body = ''; }
export async function removePrivate(n) { delete privKeys[n.id]; delete n.priv; n.updated = Date.now(); await persist(); }
