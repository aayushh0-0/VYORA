import { defineConfig } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Vanilla HTML/CSS/JS frontend.
 * - Dev: Vite on :5173, proxies /api → Express :3000
 * - Prod build: outputs to /dist for Express to serve
 */
export default defineConfig({
  root: path.resolve(__dirname, 'frontend/public'),
  publicDir: false,
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
    // Classic multi-script HTML; no module graph required
    rollupOptions: {
      input: path.resolve(__dirname, 'frontend/public/index.html')
    }
  }
});
