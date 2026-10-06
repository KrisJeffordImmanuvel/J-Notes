/* Vite plugin: emits sw.js with a precache list of every built file, versioned by content. */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

function walk(dir) {
  let out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    out = statSync(p).isDirectory() ? out.concat(walk(p)) : out.concat(p);
  }
  return out;
}

export function swPlugin({ publicDir = 'public' } = {}) {
  return {
    name: 'jnotes-sw',
    apply: 'build',
    generateBundle(_, bundle) {
      const hash = createHash('sha256');
      const files = [];
      for (const [name, chunk] of Object.entries(bundle)) {
        if (name.endsWith('.map')) continue;
        files.push(name);
        hash.update(name).update(chunk.type === 'chunk' ? chunk.code : chunk.source);
      }
      for (const p of walk(publicDir)) {
        const name = relative(publicDir, p).split('\\').join('/');
        files.push(name);
        hash.update(name).update(readFileSync(p));
      }
      const version = hash.digest('hex').slice(0, 12);
      const assets = ['./', ...files.sort().map(f => './' + f)];
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: swSource(version, assets) });
    }
  };
}

const swSource = (version, assets) => `/* J Notes service worker — generated at build time. */
const CACHE = 'jnotes-${version}';
const ASSETS = ${JSON.stringify(assets, null, 1)};

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('jnotes-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') {
    // Network first for the page so updates arrive; fall back to the cached app offline.
    e.respondWith(fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./'))));
    return;
  }
  // Build files are content-hashed, so cache first is safe.
  e.respondWith(caches.match(req).then(r => r || fetch(req)));
});
`;
