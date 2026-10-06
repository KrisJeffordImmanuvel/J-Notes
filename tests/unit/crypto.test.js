import { describe, it, expect } from 'vitest';
import { wrapWith, unwrapWith, importRaw, aesEnc, aesDec, makeRecoveryWords, normWords, WORDS } from '../../src/lib/crypto.js';
import { enc, dec, rand } from '../../src/lib/util.js';

describe('crypto', () => {
  it('encrypts and decrypts with AES-GCM', async () => {
    const key = await importRaw(rand(32));
    const box = await aesEnc(key, enc('dear diary ✍️'));
    expect(box.iv).toBeTruthy();
    expect(dec(await aesDec(key, box))).toBe('dear diary ✍️');
  });

  it('wraps the vault key with a PIN and rejects a wrong PIN', async () => {
    const raw = rand(32);
    const w = await wrapWith('1234', raw);
    expect([...await unwrapWith('1234', w)]).toEqual([...raw]);
    await expect(unwrapWith('9999', w)).rejects.toThrow();
  }, 20000);

  it('detects tampering', async () => {
    const key = await importRaw(rand(32));
    const box = await aesEnc(key, enc('secret'));
    const ct = atob(box.ct).split('');
    ct[0] = String.fromCharCode(ct[0].charCodeAt(0) ^ 1);
    await expect(aesDec(key, { ...box, ct: btoa(ct.join('')) })).rejects.toThrow();
  });

  it('makes 24 recovery words from the word list', () => {
    const words = makeRecoveryWords();
    expect(words).toHaveLength(24);
    words.forEach(w => expect(WORDS).toContain(w));
    expect(new Set(WORDS).size).toBe(WORDS.length);
  });

  it('normalises typed recovery words', () => {
    expect(normWords('  Apple,  AMBER\nanchor ')).toBe('apple amber anchor');
  });
});
