# J Notes

A calm, private, local-first notes and diary app. Everything stays on your device: there's no account, no tracking and no server.

- **Notes:** notebooks, tags, favourites, pins, Markdown with a formatting toolbar, version history and a 30-day trash.
- **Diary:** calendar, mood and energy, a monthly mood chart, "on this day", writing prompts, a gentle reminder and a printable diary book.
- **Privacy:** optional app lock that encrypts everything with AES-256-GCM (key derived from your PIN with PBKDF2), a 24-word recovery key, auto-lock, and per-entry passwords.
- **Your data:** export as Markdown (.zip) or JSON, import from Obsidian, Joplin, Notion, Bear and Day One exports, daily snapshots, and sync to your own folder (Chromium on desktop).
- **Works offline:** you can install it as an app on desktop or phone.
- **Optional Google sign-in:** sync notes and diary across your devices through a hidden J Notes folder in your own Google Drive. No J Notes server is involved.

## Getting started

```bash
npm install
npm run dev          # http://localhost:5173
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server with hot reload |
| `npm run build` | Production build of the installable app in `dist/` |
| `npm run build:single` | One self-contained HTML file in `dist-single/` that opens straight from disk |
| `npm run build:all` | Both builds, and copies `J_Notes.html` into `dist/` as a download |
| `npm run preview` | Serve the production build |
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | Browser tests (Playwright, Chromium) |
| `npm run lint` | ESLint |
| `npm run icons` | Re-render the PNG app icons from `public/icons/icon.svg` |

## Project layout

```
index.html              app shell
src/main.js             entry: styles, global handlers, PWA, boot
src/app.js              boot sequence (storage → unlock → start)
src/lib/                pure helpers: storage, crypto, markdown, zip, icons, util
src/data/               state, saving and snapshots, vault, import/export, folder sync
src/ui/                 views and dialogs: nav, sidebar, notes, editor, diary, home, search, settings…
src/styles/             CSS (design tokens and themes in base.css)
build/sw-plugin.js      generates the versioned service worker at build time
tests/unit, tests/e2e   Vitest and Playwright tests
```

The code doesn't use a framework or ship any runtime dependencies. Views render HTML strings, and a single delegated click handler routes `data-act` attributes to the actions in `src/ui/actions.js`.

## How your data is stored

- Data is kept in the browser's **IndexedDB**, which has room for hundreds of MB. Photos and the 7 daily snapshots no longer compete for the roughly 5 MB that `localStorage` allows. Data saved by the old single-file version in `localStorage` is moved over automatically on the same site.
- The stored format (`jnotes:v1`) hasn't changed, so backups from any version import cleanly. Backups are **merged**, so a newer note is never replaced by an older copy.
- With the app lock on, only ciphertext is stored, including the snapshots and the folder-sync vault file.
- Browser storage belongs to one site. Notes written in the HTML file opened from disk won't appear on the hosted app automatically. To move them, use **Settings → Backup & export → Full backup**, then **Import** on the other side.

## Google sign-in and sync

Signing in is optional. When it's set up, **Continue with Google** appears in the welcome dialog, on Home and in **Settings → Account & sync**. The same button signs in and signs up.

- **Where notes go:** one file in the Drive `appDataFolder` (hidden from the Drive UI), in the same format as local storage. J Notes asks only for `drive.appdata`, so it can't see any other Drive files.
- **How syncing works:**
  - Each device pulls the file if it changed, merges it, then pushes. The newest version of each note wins, and permanently deleted notes leave tombstones so they don't come back.
  - A fresh install simply takes the cloud copy.
  - Sync runs a few seconds after you write, when the app comes back into view, and every two minutes.
- **App lock:** with the lock on, the cloud copy is encrypted before upload. The lock is shared across devices: the latest change wins, and a new device asks once for the PIN (or recovery key).
- **Sessions:** there's no server, so the browser gets a one-hour access token. After it expires, sync pauses until you press **Reconnect**.

### Setting it up (one time)

1. In the [Google Cloud console](https://console.cloud.google.com/), create a project, e.g. "J Notes".
2. **APIs & Services → Library**: enable the **Google Drive API**.
3. **Google Auth Platform**:
   - **Branding:** app name J Notes and your support email.
   - **Audience:** External. While the app is in *Testing*, add your Google account under **Test users**.
   - **Data access:** add the scopes `.../auth/drive.appdata`, `openid`, `email` and `profile`.
4. **Clients → Create client → Web application**. Under **Authorized JavaScript origins**, add `https://<your-user>.github.io`, plus `http://localhost:5173` for development. No redirect URIs are needed.
5. Copy the client ID, then:
   - **Deployed site:** in GitHub, go to **Settings → Secrets and variables → Actions → Variables → New repository variable**, name it `GOOGLE_CLIENT_ID` and paste the ID. The next deploy includes sign-in.
   - **Local development:** put `VITE_GOOGLE_CLIENT_ID=<the ID>` in `.env.local`.

The client ID isn't a secret; it's visible in any web app that uses Google sign-in. Without it, the sign-in UI stays hidden. The single-file `J_Notes.html` never shows sign-in, because Google sign-in needs a real web address.

## Deploying

`.github/workflows/ci.yml` runs lint, unit tests and browser tests on every push and pull request. Pushes to `main` are then published to **GitHub Pages**. To turn this on, go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions** (this only needs doing once). The site is built with relative paths, so it also works from any sub-folder or static host.
