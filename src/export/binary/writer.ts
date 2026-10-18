const encoder = new TextEncoder();

/** Encodes a string as UTF-8 bytes. */
export const utf8 = (text: string) => encoder.encode(text);

/** Little-endian binary writer used by every exported file format. */
export class BinaryWriter {
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
