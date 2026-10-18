import type { ExportFiles } from '../../domain/types';
import { crc32 } from './crc32';
import { BinaryWriter, utf8 } from './writer';

/** Packs files into a stored (uncompressed) ZIP archive. */
export function zipFiles(files: ExportFiles) {
  const writer = new BinaryWriter(),
    records = [];
  for (const [path, content] of Object.entries(files)) {
    if (path.startsWith('/') || path.split('/').includes('..') || path.includes('\\'))
      throw new Error('Invalid ZIP path.');
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
