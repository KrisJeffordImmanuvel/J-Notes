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
      environment: 'node',
      env: { VITE_GOOGLE_CLIENT_ID: 'test-client.apps.googleusercontent.com', VITE_OWNER_EMAIL_HASH: 'dcad3b18c54f8330a460d6517d418d6efc5c6dfb777cbd8514a5106e59060537' /* kris@example.com */ }
    }
  };
});
