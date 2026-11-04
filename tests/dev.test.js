import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
test('development assets and HMR websocket share the protected localhost port', async () => {
  const child = spawn(process.execPath, ['server/index.js', '--dev', '--test'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: '3109' },
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '';
  child.stdout.on('data', (d) => (logs += d));
  child.stderr.on('data', (d) => (logs += d));
  let socket;
  try {
    const deadline = Date.now() + 20000;
    let response;
    while (Date.now() < deadline) {
      try {
        response = await fetch('http://127.0.0.1:3109/api/health');
        if (response.ok) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 80));
    }
    assert.equal(response?.status, 200, logs);
    const homepage = await fetch('http://127.0.0.1:3109/');
    assert.equal(homepage.status, 200);
    assert.match(await homepage.text(), /src\/main\.jsx/);
    const client = await (await fetch('http://127.0.0.1:3109/@vite/client')).text();
    const token = client.match(/const wsToken\s*=\s*["']([^"']+)/)?.[1];
    assert.ok(token, 'Vite provides a websocket token');
    socket = new WebSocket('ws://127.0.0.1:3109/?token=' + encodeURIComponent(token), 'vite-hmr');
    await Promise.race([
      once(socket, 'open'),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error('HMR did not connect on the main localhost port')),
          3000,
        ).unref(),
      ),
    ]);
    assert.equal(socket.readyState, WebSocket.OPEN);
  } finally {
    socket?.close();
    child.kill('SIGTERM');
    await Promise.race([
      once(child, 'exit'),
      new Promise((r) =>
        setTimeout(() => {
          child.kill('SIGKILL');
          r();
        }, 4000).unref(),
      ),
    ]);
  }
});
