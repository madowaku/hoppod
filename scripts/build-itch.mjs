// itch.io upload: a ZIP of the playable files in public/, index.html at its
// root. Leaves out the developer bench (dev/) and dotfiles (.assetsignore).
// No dependencies: a stored-or-deflated ZIP written with node:zlib.
// Usage: node scripts/build-itch.mjs [out.zip]
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname, relative, sep } from 'node:path';
import { deflateRawSync, crc32 } from 'node:zlib';

export const ROOT = 'public';
export const SKIP = name => name.startsWith('.') || name === 'dev';

export async function playableFiles(dir = ROOT) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (SKIP(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await playableFiles(path)); else out.push(path);
  }
  return out.sort();
}

// A fixed timestamp (2026-11-08 00:00), so the same files give the same ZIP.
const DOS_TIME = 0, DOS_DATE = ((2026 - 1980) << 9) | (11 << 5) | 8;
export async function buildZip(files) {
  const locals = [], centrals = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(relative(ROOT, file).split(sep).join('/')), data = await readFile(file);
    const packed = deflateRawSync(data, { level: 9 }), deflate = packed.length < data.length, body = deflate ? packed : data;
    const crc = crc32(data), method = deflate ? 8 : 0;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(method, 8);
    local.writeUInt16LE(DOS_TIME, 10); local.writeUInt16LE(DOS_DATE, 12); local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(method, 10); central.writeUInt16LE(DOS_TIME, 12); central.writeUInt16LE(DOS_DATE, 14); central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(name.length, 28); central.writeUInt32LE(offset, 42);
    locals.push(local, name, body); centrals.push(central, name);
    offset += 30 + name.length + body.length;
  }
  const directory = Buffer.concat(centrals), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

if (process.argv[1]?.endsWith('build-itch.mjs')) {
  const out = process.argv[2] || 'output/itch/rapippo.zip', files = await playableFiles();
  const zip = await buildZip(files);
  await mkdir(dirname(out), { recursive: true }); await writeFile(out, zip);
  console.log(files.map(f => relative(ROOT, f).split(sep).join('/')).join('\n'));
  console.log(`${out}: ${files.length} files, ${(zip.length / 1024).toFixed(1)} KiB`);
}
