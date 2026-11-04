import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JobStore } from '../server/jobs.js';
test('simultaneous crash recovery grants exclusive data ownership to one process', async () => {
  let doubleOwners = 0;
  for (let i = 0; i < 10; i++) {
    const dir = await mkdtemp(join(tmpdir(), 'local-stale-lock-test-'));
    await writeFile(join(dir, 'instance.lock'), JSON.stringify({ pid: 2147483647, createdAt: 0 }));
    const a = new JobStore({ dataRoot: dir }),
      b = new JobStore({ dataRoot: dir });
    const result = await Promise.allSettled([a.init(), b.init()]);
    const success = result
      .map((r, index) => (r.status === 'fulfilled' ? [a, b][index] : null))
      .filter(Boolean);
    if (success.length > 1) doubleOwners++;
    const lockText = await readFile(join(dir, 'instance.lock'), 'utf8');
    for (const store of success) await store.close();
    await rm(dir, { recursive: true, force: true });
    assert.ok(success.length >= 1, 'At least one contender recovers the stale instance.');
    assert.equal(
      JSON.parse(lockText).pid,
      process.pid,
      'Replacement lock retains parseable process ownership.',
    );
  }
  assert.equal(doubleOwners, 0, 'A stale lock cannot allow multiple owners.');
});
