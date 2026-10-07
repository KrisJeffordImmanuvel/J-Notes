/* Google sign-in (Google Identity Services token model) and the Drive REST calls J Notes needs.
 *
 * No server is involved: the browser gets a short-lived access token (about 1 hour) limited to
 * J Notes' own hidden folder in the user's Drive (`drive.appdata`) plus their basic profile.
 * The Google script is only loaded when someone uses sign-in. */

export const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const GIS_SRC = 'https://accounts.google.com/gsi/client';
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const SCOPES = `${DRIVE_SCOPE} openid email profile`;
const TOKEN_KEY = 'jnotes:gtoken';

/** Sign-in needs a client ID at build time and a real web origin (not a file opened from disk). */
export const googleAvailable = () => !!CLIENT_ID && /^https?:$/.test(location.protocol);

export class AuthError extends Error { }

/* ---------- access token (kept for this browser session only) ---------- */
let token = null;
try { const t = JSON.parse(sessionStorage.getItem(TOKEN_KEY)); if (t && t.exp > Date.now()) token = t; } catch (e) { }

export const validToken = () => (token && token.exp > Date.now() ? token.value : null);
export function forgetToken() { token = null; try { sessionStorage.removeItem(TOKEN_KEY); } catch (e) { } }
function keepToken(value, expiresIn) {
  token = { value, exp: Date.now() + (Number(expiresIn) || 3600) * 1000 - 60_000 };
  try { sessionStorage.setItem(TOKEN_KEY, JSON.stringify(token)); } catch (e) { }
}

/* ---------- Google Identity Services ---------- */
let gisLoading = null;
/** Load the Google sign-in script (call early, e.g. on hover, so the click opens the popup instantly). */
export function loadGoogle() {
  if (globalThis.google?.accounts?.oauth2) return Promise.resolve();
  if (!gisLoading) {
    gisLoading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = GIS_SRC; s.async = true;
      s.onload = () => resolve();
      s.onerror = () => { gisLoading = null; reject(new Error('Could not reach Google. Check your connection and try again.')); };
      document.head.appendChild(s);
    });
  }
  return gisLoading;
}

/**
 * Open Google's sign-in popup and get an access token. Must run from a click.
 * `hint` pre-selects an account; `prompt: ''` skips the account chooser when access was granted before.
 */
export async function requestToken({ hint, prompt = 'select_account' } = {}) {
  await loadGoogle();
  return new Promise((resolve, reject) => {
    const oauth2 = globalThis.google.accounts.oauth2;
    const client = oauth2.initTokenClient({
      client_id: CLIENT_ID, scope: SCOPES, hint, prompt,
      callback: r => {
        if (r.error) return reject(new AuthError(r.error_description || 'Google sign-in failed.'));
        if (!oauth2.hasGrantedAllScopes(r, DRIVE_SCOPE)) return reject(new AuthError('J Notes needs permission to use its own folder in your Google Drive to sync. Please try again and tick that box.'));
        keepToken(r.access_token, r.expires_in);
        resolve(r.access_token);
      },
      error_callback: e => reject(new AuthError(e && e.type === 'popup_closed' ? 'Sign-in was cancelled.' : e && e.type === 'popup_failed_to_open' ? 'Your browser blocked the Google sign-in window. Allow pop-ups for this site and try again.' : 'Google sign-in failed.'))
    });
    client.requestAccessToken();
  });
}

/** Withdraw J Notes' access to the Google account (best effort). */
export function revokeAccess() {
  const t = validToken();
  forgetToken();
  try { if (t && globalThis.google?.accounts?.oauth2) globalThis.google.accounts.oauth2.revoke(t, () => { }); } catch (e) { }
}

/* ---------- REST helpers ---------- */
async function call(url, opts = {}) {
  const t = validToken();
  if (!t) throw new AuthError('Google session expired');
  const r = await fetch(url, { ...opts, headers: { Authorization: `Bearer ${t}`, ...(opts.headers || {}) } });
  if (r.status === 401) { forgetToken(); throw new AuthError('Google session expired'); }
  if (!r.ok) {
    const err = new Error(`Google Drive error ${r.status}`);
    err.status = r.status;
    throw err;
  }
  return r;
}

export async function getProfile() {
  const p = await (await call('https://www.googleapis.com/oauth2/v3/userinfo')).json();
  return { sub: p.sub, email: p.email || '', name: p.name || p.email || 'Google account', picture: p.picture || '' };
}

/* ---------- Drive: one file in the hidden app folder ---------- */
const API = 'https://www.googleapis.com/drive/v3', UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
export const SYNC_FILE = 'jnotes-sync.json';
const FIELDS = 'id,version,modifiedTime';

/** All copies of the sync file, oldest first (normally exactly one). */
export async function listSyncFiles() {
  const q = encodeURIComponent(`name='${SYNC_FILE}' and trashed=false`);
  const r = await call(`${API}/files?spaces=appDataFolder&q=${q}&orderBy=createdTime&fields=files(${FIELDS})`);
  return (await r.json()).files || [];
}
export async function getFileMeta(id) {
  try { return await (await call(`${API}/files/${id}?fields=${FIELDS}`)).json(); }
  catch (e) { if (e.status === 404) return null; throw e; }
}
export async function downloadFile(id) { return (await call(`${API}/files/${id}?alt=media`)).text(); }
export async function deleteFile(id) {
  try { await call(`${API}/files/${id}`, { method: 'DELETE' }); } catch (e) { if (e.status !== 404) throw e; }
}

/** Create (no id) or replace the sync file. Small files go in one request; large ones use a resumable upload. */
export async function uploadFile(id, text) {
  const meta = id ? {} : { name: SYNC_FILE, parents: ['appDataFolder'], mimeType: 'application/json' };
  const method = id ? 'PATCH' : 'POST', path = id ? `/files/${id}` : '/files';
  if (text.length < 4 * 1024 * 1024) {
    const b = 'jnotes' + Math.random().toString(36).slice(2);
    const body = `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${b}\r\nContent-Type: application/json\r\n\r\n${text}\r\n--${b}--`;
    return (await call(`${UPLOAD}${path}?uploadType=multipart&fields=${FIELDS}`, { method, headers: { 'Content-Type': `multipart/related; boundary=${b}` }, body })).json();
  }
  const start = await call(`${UPLOAD}${path}?uploadType=resumable&fields=${FIELDS}`, {
    method, headers: { 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': 'application/json' }, body: JSON.stringify(meta)
  });
  const session = start.headers.get('Location');
  if (!session) throw new Error('Google Drive did not accept the upload.');
  return (await call(session, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: text })).json();
}
