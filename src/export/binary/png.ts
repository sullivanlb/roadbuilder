import { crc32 } from './crc32';
import { BinaryWriter, utf8 } from './writer';

function bigEndian(n: number) {
  return Uint8Array.of(n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255);
}
function concat(...arrays: Uint8Array[]) {
  const out = new Uint8Array(arrays.reduce((n, a) => n + a.length, 0));
  let offset = 0;
  for (const a of arrays) {
    out.set(a, offset);
    offset += a.length;
  }
  return out;
}
function pngChunk(name: string, bytes: Uint8Array) {
  const body = concat(utf8(name), bytes);
  return concat(bigEndian(bytes.length), body, bigEndian(crc32(body)));
}

/** Encodes RGBA pixels into a PNG image (stored deflate blocks). */
export function encodePng(width: number, height: number, pixels: Uint8Array) {
  if (pixels.length !== width * height * 4) throw new Error('Dimensions PNG invalides.');
  const scanlines = new Uint8Array((width * 4 + 1) * height);
  for (let y = 0; y < height; y++)
    scanlines.set(pixels.subarray(y * width * 4, (y + 1) * width * 4), y * (width * 4 + 1) + 1);
  const deflate = new BinaryWriter();
  deflate.raw(Uint8Array.of(0x78, 0x01));
  for (let offset = 0; offset < scanlines.length; offset += 65535) {
    const block = scanlines.subarray(offset, offset + 65535);
    deflate
      .u8(offset + block.length === scanlines.length ? 1 : 0)
      .u16(block.length)
      .u16(0xffff ^ block.length)
      .raw(block);
  }
  let a = 1,
    b = 0;
  for (const value of scanlines) {
    a = (a + value) % 65521;
    b = (b + a) % 65521;
  }
  deflate.raw(bigEndian(((b << 16) | a) >>> 0));
  return concat(
    Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10),
    pngChunk('IHDR', concat(bigEndian(width), bigEndian(height), Uint8Array.of(8, 6, 0, 0, 0))),
    pngChunk('IDAT', deflate.finish()),
    pngChunk('IEND', new Uint8Array()),
  );
}

/** Builds the 32×32 noise texture of a material, deterministic per color. */
export function texturePng(color: number[], noise = 12) {
  const pixels = new Uint8Array(32 * 32 * 4);
  let seed = 8241;
  for (let i = 0; i < pixels.length; i += 4) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const offset = ((seed >>> 16) / 65535 - 0.5) * noise;
    for (let c = 0; c < 3; c++) pixels[i + c] = Math.max(0, Math.min(255, color[c] + offset));
    pixels[i + 3] = 255;
  }
  return encodePng(32, 32, pixels);
}
