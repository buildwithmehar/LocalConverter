import { createApp } from './app.js';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error('PORT must be an integer between 1024 and 65535.');
const server = createServer();
const instance = await createApp({
  port,
  httpServer: server,
  dev: process.argv.includes('--dev'),
  ...(process.argv.includes('--test')
    ? { dataRoot: fileURLToPath(new URL(`../.artifacts/runtime-tests/${port}`, import.meta.url)) }
    : {}),
});
server.on('request', instance.app);
server.listen(port, '127.0.0.1', () =>
  console.log(
    `\nLocal Converter is running at http://127.0.0.1:${port}\nFiles are processed on this computer. Press Ctrl+C to stop.\n`,
  ),
);
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  server.close();
  await instance.close();
  process.exit(0);
}
process.on('SIGINT', close);
process.on('SIGTERM', close);
server.on('error', (error) => {
  console.error(
    error.code === 'EADDRINUSE'
      ? `Port ${port} is already in use. Set PORT to an unused local port.`
      : error.message,
  );
  void instance.close().then(() => process.exit(1));
});
