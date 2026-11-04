import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: {
    host: '127.0.0.1',
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
    proxy: { '/api': 'http://127.0.0.1:3000' },
  },
  worker: { format: 'es' },
  build: {
    outDir: 'dist',
    target: 'es2022',
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'ui-motion',
              test: /node_modules[\\/](?:motion(?:-dom|-utils)?|framer-motion|@react-spring|(?:react-)?flip-toolkit)[\\/]/,
            },
          ],
        },
      },
    },
  },
});
