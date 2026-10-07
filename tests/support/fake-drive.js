/* In-memory stand-in for the Google endpoints J Notes calls (userinfo + Drive appDataFolder).
 * Shared by the unit tests (via fetch) and the browser tests (via request routing). */
export function createFakeDrive({ sub = 'user-1', email = 'kris@example.com', name = 'Kris' } = {}) {
  const files = new Map();
  let seq = 0;
  const drive = { files, uploads: 0, downloads: 0, profile: { sub, email, name, picture: '' } };
  const meta = f => ({ id: f.id, version: String(f.version), modifiedTime: new Date(f.t).toISOString() });
  const json = (o, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(o) });

  /** Handle one request: returns { status, contentType, body }. */
  drive.handle = (method, url, headers, body) => {
    const u = new URL(url);
    const auth = headers.authorization || headers.Authorization || '';
    if (!/^Bearer token-/.test(auth)) return json({ error: 'unauthorized' }, 401);
    if (u.pathname === '/oauth2/v3/userinfo') return json(drive.profile);
    if (u.pathname === '/drive/v3/files' && method === 'GET') {
      return json({ files: [...files.values()].sort((a, b) => a.created - b.created).map(meta) });
    }
    let m = u.pathname.match(/^\/drive\/v3\/files\/([\w-]+)$/);
    if (m) {
      const f = files.get(m[1]);
      if (!f) return json({ error: 'not found' }, 404);
      if (method === 'DELETE') { files.delete(f.id); return { status: 204, contentType: 'text/plain', body: '' }; }
      if (u.searchParams.get('alt') === 'media') { drive.downloads++; return { status: 200, contentType: 'application/json', body: f.content }; }
      return json(meta(f));
    }
    m = u.pathname.match(/^\/upload\/drive\/v3\/files(?:\/([\w-]+))?$/);
    if (m && u.searchParams.get('uploadType') === 'multipart') {
      const ct = headers['content-type'] || headers['Content-Type'];
      const boundary = /boundary=(\S+)/.exec(ct)[1];
      const parts = body.split(`--${boundary}`);
      const content = parts[2].slice(parts[2].indexOf('\r\n\r\n') + 4).replace(/\r\n$/, '');
      drive.uploads++;
      let f = m[1] && files.get(m[1]);
      if (m[1] && !f) return json({ error: 'not found' }, 404);
      if (!f) { f = { id: 'file' + (++seq), version: 0, created: Date.now() + seq }; files.set(f.id, f); }
      f.content = content; f.version++; f.t = Date.now();
      return json(meta(f));
    }
    return json({ error: `unexpected ${method} ${u.pathname}` }, 400);
  };
  return drive;
}

/** Script that stands in for https://accounts.google.com/gsi/client. */
export const FAKE_GIS = `window.google = { accounts: { oauth2: {
  initTokenClient: c => ({ requestAccessToken: () => setTimeout(() => c.callback({ access_token: 'token-' + Math.random().toString(36).slice(2), expires_in: 3600 }), 20) }),
  hasGrantedAllScopes: () => true,
  revoke: (t, cb) => cb && cb()
} } };`;
