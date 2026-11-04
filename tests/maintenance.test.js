import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, access } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { cleanArtifacts } from '../scripts/clean.mjs';

test('cleanup removes only generated artifacts and dry run preserves all files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lc-cleanup-'));
  try {
    for (const path of [
      'src/keep.js',
      '.local-data/jobs/original.txt',
      '.tools/models/model.bin',
      'node_modules/runtime.js',
      '.artifacts/screenshots/temporary.png',
    ]) {
      await mkdir(join(root, path, '..'), { recursive: true });
      await writeFile(join(root, path), 'keep');
    }
    await cleanArtifacts({ root, dryRun: true });
    await access(join(root, '.artifacts/screenshots/temporary.png'));
    await cleanArtifacts({ root });
    await assert.rejects(access(join(root, '.artifacts')));
    for (const path of [
      'src/keep.js',
      '.local-data/jobs/original.txt',
      '.tools/models/model.bin',
      'node_modules/runtime.js',
    ])
      assert.equal(await readFile(join(root, path), 'utf8'), 'keep');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test('cleanup refuses to remove a running test server data directory', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lc-cleanup-lock-'));
  try {
    await mkdir(join(root, '.artifacts/runtime-tests/3107'), { recursive: true });
    const lock = join(root, '.artifacts/runtime-tests/3107/instance.lock');
    await writeFile(lock, JSON.stringify({ pid: process.pid }));
    await assert.rejects(cleanArtifacts({ root }), /still running/);
    await access(lock);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
