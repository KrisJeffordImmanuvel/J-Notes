# J Notes

A calm, private, local-first notes and diary app. Everything stays on your device: there's no account, no tracking and no server.

- **Notes:** notebooks, tags, favourites, pins, Markdown with a formatting toolbar, version history and a 30-day trash.
- **Diary:** calendar, mood and energy, a monthly mood chart, "on this day", writing prompts, a gentle reminder and a printable diary book.
- **Privacy:** optional app lock that encrypts everything with AES-256-GCM (key derived from your PIN with PBKDF2), a 24-word recovery key, auto-lock, and per-entry passwords.
- **Your data:** export as Markdown (.zip) or JSON, import from Obsidian, Joplin, Notion, Bear and Day One exports, daily snapshots, and sync to your own folder (Chromium on desktop).
- **Works offline:** you can install it as an app on desktop or phone.

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

## Deploying

`.github/workflows/ci.yml` runs lint, unit tests and browser tests on every push and pull request. Pushes to `main` are then published to **GitHub Pages**. To turn this on, go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions** (this only needs doing once). The site is built with relative paths, so it also works from any sub-folder or static host.
