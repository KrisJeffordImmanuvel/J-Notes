import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { swPlugin } from './build/sw-plugin.js';

/** The single-file build has no manifest, icons or service worker — it is opened straight from disk. */
const stripPwaLinks = () => ({
  name: 'jnotes-strip-pwa',
  transformIndexHtml: html => html.replace(/\s*<link[^>]*data-pwa[^>]*>/g, '')
});

export default defineConfig(({ mode }) => {
  const single = mode === 'single';
  return {
    base: './',
    publicDir: single ? false : 'public',
    plugins: single ? [stripPwaLinks(), viteSingleFile()] : [swPlugin()],
    build: {
      outDir: single ? 'dist-single' : 'dist',
      target: 'es2020',
      emptyOutDir: true
    },
    test: {
      include: ['tests/unit/**/*.test.js'],
      environment: 'node'
    }
  };
});
