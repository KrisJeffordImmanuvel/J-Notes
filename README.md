# J Notes

A calm, private, local-first notes and diary app. Everything stays on your device: there's no account, no tracking and no server.

- **Notes:** notebooks, tags, favourites, pins, Markdown with a formatting toolbar, version history and a 30-day trash.
- **Diary:** calendar, mood and energy, a monthly mood chart, "on this day", writing prompts, a gentle reminder and a printable diary book.
- **Privacy:** optional app lock that encrypts everything with AES-256-GCM (key derived from your PIN with PBKDF2), a 24-word recovery key, auto-lock, and per-entry passwords.
- **Your data:** export as Markdown (.zip) or JSON, import from Obsidian, Joplin, Notion, Bear and Day One exports, daily snapshots, and sync to your own folder (Chromium on desktop).
- **Works offline:** you can install it as an app on desktop or phone.
- **Personal and synced:** only the owner's Google account can open it on a new device, and notes sync across devices through a hidden folder in your own Google Drive, encrypted with your PIN. No J Notes server is involved.

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

## Personal mode, Google sign-in and sync

This J Notes is set up for **one person**. When the site is built with the owner's details, it runs in personal mode:

- **A new device** opens on a sign-in screen. Only the owner's Google account is accepted; any other account is refused and disconnected. After signing in, your notes come down from your Google Drive and open with your PIN.
- **Your PIN is always required.** If a device has notes without a PIN, J Notes asks you to set one before you can continue, and the app lock can't be turned off. Nothing is uploaded until the PIN is set, so the cloud copy is always encrypted.
- **No sample content.** A new device starts empty and fills from your cloud copy.
- **Search engines** are asked not to index the site (`noindex`).

The website itself is public (GitHub Pages can't password-protect it), but visitors only see the sign-in screen. Your notes are never on the site: they live in your browser and in your own Google Drive, encrypted with your PIN.

**How sync works:** one encrypted file in your Google Drive's hidden app folder (`drive.appdata` scope, so J Notes can't see your other Drive files). Each device pulls the file if it changed, merges it (the newest version of each note wins, and deletions are remembered), then pushes. Sync runs a few seconds after you write, when you return to the app, every two minutes and on demand. Google's sign-in lasts about an hour; after that, press **Reconnect**.

### Setting it up (one time)

1. In the [Google Cloud console](https://console.cloud.google.com/), create a project, e.g. "J Notes", and enable the **Google Drive API**.
2. **Google Auth Platform**:
   - **Branding:** app name J Notes and your email.
   - **Audience:** External, and leave it in **Testing**. Add only your Gmail under **Test users**; Google then refuses every other account, and you never need Google's review.
   - **Data access:** add the scopes `.../auth/drive.appdata`, `openid`, `email` and `profile`.
3. **Clients → Create client → Web application**. Under **Authorized JavaScript origins**, add `https://<your-user>.github.io`, plus `http://localhost:5173` for development. Copy the client ID.
4. In GitHub, go to **Settings → Secrets and variables → Actions → Variables** and add:
   - `GOOGLE_CLIENT_ID`: the client ID.
   - `OWNER_EMAIL_HASH`: the SHA-256 of your lower-case Gmail address, from `printf '%s' 'you@gmail.com' | sha256sum`. Your address itself never appears in the code.
5. Re-run the latest **CI & Deploy** run, or push to `main`.

Without `GOOGLE_CLIENT_ID`, sign-in is hidden. Without `OWNER_EMAIL_HASH`, sign-in is optional and any test user can sign in. The single-file `J_Notes.html` is an offline copy that never shows sign-in. For local development, put both values in `.env.local` (see `.env.example`).

## Deploying

`.github/workflows/ci.yml` runs lint, unit tests and browser tests on every push and pull request. Pushes to `main` are then published to **GitHub Pages**. To turn this on, go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions** (this only needs doing once). The site is built with relative paths, so it also works from any sub-folder or static host.
