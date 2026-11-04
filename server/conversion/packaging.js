import { zipSync, gzipSync } from 'fflate';
import { gunzipSync, inflateRawSync, crc32 } from 'node:zlib';
import { LIMITS, fail } from './common.js';

// Validate the central directory before inflating. zlib bounds decompression;
// CRC checks reject silently corrupted payloads before document parsers run.
export function inspectZip(buffer) {
  if (buffer.length < 22 || buffer.readUInt32LE(0) !== 0x04034b50)
    fail('Invalid ZIP file signature.');
  let end = buffer.length - 22;
  while (end >= Math.max(0, buffer.length - 65558) && buffer.readUInt32LE(end) !== 0x06054b50)
    end--;
  if (end < 0 || buffer.readUInt32LE(end) !== 0x06054b50) fail('Invalid ZIP directory.');
  const count = buffer.readUInt16LE(end + 10);
  if (
    buffer.readUInt16LE(end + 4) ||
    buffer.readUInt16LE(end + 6) ||
    count > LIMITS.archiveEntries ||
    !count
  )
    fail('Unsupported multi-disk, empty or excessive ZIP archive.');
  if (buffer.readUInt16LE(end + 8) !== count || count === 65535) fail('ZIP64 is unsupported.');
  let cursor = buffer.readUInt32LE(end + 16);
  const directoryEnd = cursor + buffer.readUInt32LE(end + 12);
  if (directoryEnd > end) fail('Invalid ZIP directory bounds.');
  let expanded = 0;
  const files = Object.create(null);
  for (let i = 0; i < count; i++) {
    if (cursor + 46 > directoryEnd || buffer.readUInt32LE(cursor) !== 0x02014b50)
      fail('Invalid ZIP entry.');
    const entryType = (buffer.readUInt32LE(cursor + 38) >>> 16) & 0xf000;
    if (![0, 0x8000, 0x4000].includes(entryType))
      fail('Archive links and special entries are unsupported.');
    const flags = buffer.readUInt16LE(cursor + 8);
    const compression = buffer.readUInt16LE(cursor + 10);
    const checksum = buffer.readUInt32LE(cursor + 16);
    const compressed = buffer.readUInt32LE(cursor + 20);
    const original = buffer.readUInt32LE(cursor + 24);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const local = buffer.readUInt32LE(cursor + 42);
    expanded += original;
    if (expanded > LIMITS.archiveBytes || original === 0xffffffff || compressed === 0xffffffff)
      fail('Archive exceeds expansion limits.');
    if (flags & 1 || ![0, 8].includes(compression))
      fail('Encrypted or unsupported ZIP compression.');
    if (cursor + 46 + nameLength + extraLength + commentLength > directoryEnd)
      fail('Invalid ZIP entry length.');
    const name = new TextDecoder('utf-8', { fatal: true }).decode(
      buffer.subarray(cursor + 46, cursor + 46 + nameLength),
    );
    if (
      !name ||
      name.startsWith('/') ||
      /[\\:\0]/.test(name) ||
      name.split('/').some((s) => s === '..' || s === '.') ||
      Object.hasOwn(files, name)
    )
      fail('Unsafe or duplicate archive path.');
    if (local + 30 > buffer.length || buffer.readUInt32LE(local) !== 0x04034b50)
      fail('Invalid ZIP local header.');
    const dataOffset =
      local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
    if (dataOffset + compressed > buffer.length) fail('Truncated ZIP entry.');
    const packed = buffer.subarray(dataOffset, dataOffset + compressed);
    const data =
      compression === 0
        ? Buffer.from(packed)
        : inflateRawSync(packed, { maxOutputLength: Math.max(1, original) });
    if (data.length !== original || crc32(data) !== checksum)
      fail('ZIP entry checksum or size mismatch.');
    files[name] = data;
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}

export function safeGunzip(buffer) {
  if (buffer[0] !== 31 || buffer[1] !== 139 || buffer.length < 18) fail('Invalid GZIP signature.');
  if (buffer.readUInt32LE(buffer.length - 4) > LIMITS.archiveBytes)
    fail('GZIP exceeds expansion limit.');
  return gunzipSync(buffer, { maxOutputLength: LIMITS.archiveBytes });
}

export function convertArchive(buffer, source, target) {
  if (source === 'zip') inspectZip(buffer);
  if (source === 'gz') return zipSync({ content: safeGunzip(buffer) });
  if (target === 'gz') return gzipSync(buffer);
  return zipSync({ 'content.txt': buffer });
}
