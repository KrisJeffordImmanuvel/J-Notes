/* Fake Google sign-in + Drive for unit tests (Node: replaces globalThis.google and fetch). */
import { createFakeDrive } from '../support/fake-drive.js';

export function installFakeGoogle(opts) {
  const drive = createFakeDrive(opts);
  let seq = 0;
  globalThis.google = {
    accounts: {
      oauth2: {
        initTokenClient: ({ callback }) => ({ requestAccessToken: () => callback({ access_token: 'token-' + (++seq), expires_in: 3600 }) }),
        hasGrantedAllScopes: () => true,
        revoke: (t, cb) => cb && cb()
      }
    }
  };
  globalThis.fetch = async (url, opts = {}) => {
    const r = drive.handle(opts.method || 'GET', url, opts.headers || {}, opts.body);
    return new Response(r.status === 204 ? null : r.body, { status: r.status, headers: { 'Content-Type': r.contentType } });
  };
  return drive;
}
