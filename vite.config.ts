import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { Plugin } from 'vite';

function publicAssetWorker(): Plugin {
  return {
    name: 'public-asset-worker',
    apply: 'build',
    generateBundle(_, bundle) {
      const template = readFileSync(
        new URL('./frontend/service-worker.js', import.meta.url),
        'utf8',
      );
      const files = Object.keys(bundle)
        .filter((name) => /^assets\/.+\.(js|css)$/.test(name))
        .sort()
        .map((name) => '/' + name);
      const version = createHash('sha256')
        .update(template + JSON.stringify(files))
        .digest('hex');
      this.emitFile({
        type: 'asset',
        fileName: 'service-worker.js',
        source: template.replace(
          'const { cacheName, files } = __PUBLIC_ASSETS__',
          'const { cacheName, files } = ' +
            JSON.stringify({ cacheName: 'ilp-public-' + version, files }),
        ),
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), publicAssetWorker()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: { '/api': 'http://127.0.0.1:8000' },
  },
  build: { outDir: 'dist', sourcemap: false },
  test: {
    environment: 'jsdom',
    setupFiles: ['frontend/src/test/setup.ts'],
    include: ['frontend/src/**/*.test.{ts,tsx}'],
    restoreMocks: true,
  },
});
