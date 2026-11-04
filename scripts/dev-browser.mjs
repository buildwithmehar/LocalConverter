import { createServer } from 'vite';
const server = await createServer({
  define: { 'import.meta.env.VITE_BROWSER_ONLY': JSON.stringify('true') },
  server: { host: '127.0.0.1', port: Number(process.env.PORT || 3000) },
});
await server.listen();
server.printUrls();
