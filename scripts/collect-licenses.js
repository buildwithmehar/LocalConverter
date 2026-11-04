import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const lock = JSON.parse(await readFile(join(root, 'package-lock.json'), 'utf8'));
const rows = [],
  notices = [],
  hashes = new Set();
await mkdir(join(root, 'docs'), { recursive: true });
function addNotice(source, data) {
  notices.push(Buffer.from(`\n\n${'='.repeat(72)}\n${source}\n${'='.repeat(72)}\n\n`), data);
  hashes.add(createHash('sha256').update(data).digest('hex'));
}
for (const [location, entry] of Object.entries(lock.packages)) {
  if (!location || !location.includes('node_modules/')) continue;
  const name = location.slice(location.lastIndexOf('node_modules/') + 13);
  const folder = join(root, location);
  let licenseFiles = [];
  try {
    licenseFiles = (await readdir(folder)).filter((n) =>
      /^(?:licen[cs]e|copying|notice|ofl)(?:\.|$)/i.test(n),
    );
    for (const file of licenseFiles) {
      try {
        addNotice(`${location}/${file}`, await readFile(join(folder, file)));
      } catch {}
    }
  } catch {}
  rows.push(
    `| ${name} | ${entry.version} | ${entry.license || 'See package notices'} | ${entry.dev ? 'development' : 'runtime / optional'} |`,
  );
}
// Preserve any previously collected notice not present in the current installation during migration.
for (const file of await readdir(join(root, 'docs', 'licenses')).catch(() => []))
  try {
    const data = await readFile(join(root, 'docs', 'licenses', file));
    if (!hashes.has(createHash('sha256').update(data).digest('hex')))
      addNotice(`Previously collected: ${file}`, data);
  } catch {}
await writeFile(
  join(root, 'docs', 'THIRD-PARTY-NOTICES.txt'),
  Buffer.concat([
    Buffer.from(
      'Local Converter — third-party license and copyright notices\nLicense bodies below are preserved verbatim.\n',
    ),
    ...notices,
  ]),
);
await writeFile(
  join(root, 'docs', 'dependency-licenses.md'),
  `# Installed dependency licenses\n\nGenerated from package-lock.json and installed package notices. Full license and copyright texts are in [THIRD-PARTY-NOTICES.txt](THIRD-PARTY-NOTICES.txt). Optional platform packages can appear in the lockfile without being installed on this Windows host.\n\nExisting FFmpeg/FFprobe are not redistributed; the installed build is GPL-enabled and its external libraries retain their licenses. The app uses them as local subprocesses.\n\n| Package | Locked version | Declared license | Scope |\n|---|---|---|---|\n${rows.sort().join('\n')}\n`,
);
console.log(`Recorded ${rows.length} locked dependency entries in one consolidated notices file.`);
