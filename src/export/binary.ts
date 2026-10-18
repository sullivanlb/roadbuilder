import type { ExportFiles } from '../domain/types';
const encoder = new TextEncoder();
const utf8 = (text: string) => encoder.encode(text);

class BinaryWriter {
  bytes: Uint8Array<ArrayBuffer>;
  view: DataView<ArrayBuffer>;
  offset: number;
  constructor(size = 4096) {
    this.bytes = new Uint8Array(size);
    this.view = new DataView(this.bytes.buffer);
    this.offset = 0;
  }
  reserve(n: number) {
    if (this.offset + n <= this.bytes.length) return;
    const next = new Uint8Array(Math.max(this.offset + n, this.bytes.length * 2));
    next.set(this.bytes);
    this.bytes = next;
    this.view = new DataView(next.buffer);
  }
  u8(value: number) {
    this.reserve(1);
    this.view.setUint8(this.offset++, value);
    return this;
  }
  u16(value: number) {
    this.reserve(2);
    this.view.setUint16(this.offset, value, true);
    this.offset += 2;
    return this;
  }
  u32(value: number) {
    this.reserve(4);
    this.view.setUint32(this.offset, value, true);
    this.offset += 4;
    return this;
  }
  f32(value: number) {
    if (!Number.isFinite(value)) throw new Error('Valeur non finie dans le modèle 3D.');
    this.reserve(4);
    this.view.setFloat32(this.offset, value, true);
    this.offset += 4;
    return this;
  }
  raw(data: Uint8Array) {
    this.reserve(data.length);
    this.bytes.set(data, this.offset);
    this.offset += data.length;
    return this;
  }
  string(value: string) {
    const b = utf8(value);
    return this.u32(b.length).raw(b);
  }
  floats(values: number[]) {
    for (const n of values) this.f32(n);
    return this;
  }
  finish() {
    return this.bytes.slice(0, this.offset);
  }
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  for (let j = 0; j < 8; j++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const b of bytes) crc = crcTable[(crc ^ b) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function zipFiles(files: ExportFiles) {
  const writer = new BinaryWriter(),
    records = [];
  for (const [path, content] of Object.entries(files)) {
    if (path.startsWith('/') || path.split('/').includes('..') || path.includes('\\'))
      throw new Error('Chemin ZIP invalide.');
    const name = utf8(path),
      data = typeof content === 'string' ? utf8(content) : content;
    const crc = crc32(data),
      offset = writer.offset;
    writer
      .u32(0x04034b50)
      .u16(20)
      .u16(0x800)
      .u16(0)
      .u16(0)
      .u16(0x5c21)
      .u32(crc)
      .u32(data.length)
      .u32(data.length)
      .u16(name.length)
      .u16(0)
      .raw(name)
      .raw(data);
    records.push({ name, data, crc, offset });
  }
  const start = writer.offset;
  for (const { name, data, crc, offset } of records) {
    writer
      .u32(0x02014b50)
      .u16(20)
      .u16(20)
      .u16(0x800)
      .u16(0)
      .u16(0)
      .u16(0x5c21)
      .u32(crc)
      .u32(data.length)
      .u32(data.length)
      .u16(name.length)
      .u16(0)
      .u16(0)
      .u16(0)
      .u16(0)
      .u32(0)
      .u32(offset)
      .raw(name);
  }
  const size = writer.offset - start;
  writer
    .u32(0x06054b50)
    .u16(0)
    .u16(0)
    .u16(records.length)
    .u16(records.length)
    .u32(size)
    .u32(start)
    .u16(0);
  return writer.finish();
}

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
function encodePng(width: number, height: number, pixels: Uint8Array) {
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

function texturePng(color: number[], noise = 12) {
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
export { utf8, BinaryWriter, crc32, zipFiles, encodePng, texturePng };
