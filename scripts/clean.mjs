import { readdir, readFile, rm, lstat } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export async function cleanArtifacts({
  root = resolve(import.meta.dirname, '..'),
  dryRun = false,
} = {}) {
  const workspace = resolve(root),
    target = resolve(workspace, '.artifacts');
  if (dirname(target) !== workspace) throw new Error('Invalid artifact cleanup target.');
  let info;
  try {
    info = await lstat(target);
  } catch (error) {
    if (error.code === 'ENOENT') return { removed: false, path: target };
    throw error;
  }
  if (!info.isDirectory() || info.isSymbolicLink())
    throw new Error('Artifact output must be a real directory.');
  async function inspect(folder) {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      const path = join(folder, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) await inspect(path);
      else if (entry.name === 'instance.lock') {
        let owner;
        try {
          owner = JSON.parse(await readFile(path, 'utf8'));
        } catch {
          throw new Error('Unreadable test lock; stop test servers before cleaning.');
        }
        if (!Number.isInteger(owner.pid))
          throw new Error('Invalid test lock; stop test servers before cleaning.');
        try {
          process.kill(owner.pid, 0);
          throw new Error('A test server is still running; stop it before cleaning artifacts.');
        } catch (error) {
          if (error.code !== 'ESRCH') throw error;
        }
      }
    }
  }
  await inspect(target);
  if (!dryRun) await rm(target, { recursive: true, force: true });
  return { removed: !dryRun, dryRun, path: target };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await cleanArtifacts({ dryRun: process.argv.includes('--dry-run') });
  console.log(
    result.dryRun
      ? `Would clean ${result.path}`
      : result.removed
        ? 'Generated test and QA artifacts removed.'
        : 'No generated test artifacts to clean.',
  );
}
