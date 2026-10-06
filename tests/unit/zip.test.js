import { describe, it, expect } from 'vitest';
import { crc32, makeZip } from '../../src/lib/zip.js';
import { enc } from '../../src/lib/util.js';

describe('zip', () => {
  it('computes the standard CRC-32', () => {
    expect(crc32(enc('123456789'))).toBe(0xCBF43926);
  });

  it('writes a valid stored ZIP archive', async () => {
    const files = [{ name: 'J Notes/a.md', data: enc('hello') }, { name: 'J Notes/ü.md', data: enc('wörld') }];
    const buf = new Uint8Array(await makeZip(files).arrayBuffer());
    const v = new DataView(buf.buffer);
    expect(v.getUint32(0, true)).toBe(0x04034b50);                 // first local header
    const eocd = buf.length - 22;
    expect(v.getUint32(eocd, true)).toBe(0x06054b50);              // end of central directory
    expect(v.getUint16(eocd + 10, true)).toBe(2);                  // entry count
    const cdOffset = v.getUint32(eocd + 16, true);
    expect(v.getUint32(cdOffset, true)).toBe(0x02014b50);          // central directory header
    // first entry: name then data, uncompressed
    const nameLen = v.getUint16(26, true);
    expect(new TextDecoder().decode(buf.subarray(30, 30 + nameLen))).toBe('J Notes/a.md');
    expect(new TextDecoder().decode(buf.subarray(30 + nameLen, 35 + nameLen))).toBe('hello');
    expect(v.getUint32(14, true)).toBe(crc32(enc('hello')));
  });
});
