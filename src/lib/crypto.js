/* Web Crypto: PBKDF2-SHA256 key derivation + AES-256-GCM. */
import { enc, b64, unb64, rand } from './util.js';

export const cryptoOK = !!(globalThis.crypto && crypto.subtle);
export const KDF_ITER = 310000;

export async function deriveKey(secret, salt) {
  const base = await crypto.subtle.importKey('raw', enc(secret), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: KDF_ITER, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
export const importRaw = raw => crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
export async function aesEnc(key, bytes) { const iv = rand(12); const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes); return { iv: b64(iv), ct: b64(ct) }; }
export async function aesDec(key, o) { return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(o.iv) }, key, unb64(o.ct))); }
/** Encrypt raw key bytes with a key derived from `secret` (PIN or recovery words). */
export async function wrapWith(secret, raw) { const salt = rand(16); const k = await deriveKey(secret, salt); return { salt: b64(salt), ...(await aesEnc(k, raw)) }; }
export async function unwrapWith(secret, w) { const k = await deriveKey(secret, unb64(w.salt)); return aesDec(k, w); }

/* ---------- 24-word recovery key ---------- */
export const WORDS = ('apple amber anchor arrow autumn badge bamboo banner basket beach berry birch blanket bloom border bottle branch breeze bridge bright brook brush bucket butter cabin cactus camel candle canyon carpet castle cedar chalk cherry cliff clock cloud clover coast cobalt coffee comet copper coral cotton crane crystal current dawn delta desert dolphin dragon dream drift eagle echo ember empire engine falcon feather fern fiber field flame flute forest fossil fountain fox frost galaxy garden garnet gentle ginger glacier globe golden grain granite harbor harvest hazel heron hill honey horizon island ivory jasmine jungle kettle kite ladder lagoon lantern lemon library lily linen lotus lunar magnet mango maple marble meadow melody mint mirror monsoon moss mountain music nectar needle noble north oasis ocean olive orbit orchid otter palm paper parrot pebble pepper petal piano pilot pine planet plum pocket pond poppy prairie prism pumpkin quartz quiet rabbit radar rain raven reef ribbon river robin rocket rose ruby saddle saffron sail salmon sand sapphire satin scarlet season shadow shell silver sketch sky slate snow solar spark spice spring spruce squirrel star stone storm stream summit sun swan tablet tea temple thunder tiger timber topaz tower trail tulip tundra twilight umbrella valley velvet violet voyage walnut water wave whale wheat willow window winter wolf wonder yarrow zephyr zinc acorn atlas bison breeze2 canal cinder citrus delta2 dune elm fable fjord gecko grove haven indigo jade kayak koala lark lilac lynx mesa nova onyx opal panda pearl quill raft sage sequoia sienna sprout tango thistle tide topiary trout tusk vapor vine wren yak zebra').split(' ').map(w => w.replace(/\d/g, '')).filter((w, i, a) => a.indexOf(w) === i);

/** Uniformly pick 24 words (rejection sampling avoids modulo bias). */
export function makeRecoveryWords() {
  const n = WORDS.length, limit = Math.floor(0x100000000 / n) * n, out = [];
  while (out.length < 24) {
    for (const x of crypto.getRandomValues(new Uint32Array(32))) if (x < limit && out.length < 24) out.push(WORDS[x % n]);
  }
  return out;
}
export const normWords = s => s.toLowerCase().trim().split(/[\s,]+/).filter(Boolean).join(' ');
