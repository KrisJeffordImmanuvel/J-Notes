# J Notes

**One private note, behind a PIN.** J Notes is a single Markdown note that lives in your browser, encrypted with your PIN. There's no account, no tracking and no server.

- **One note:** open the app, enter your PIN, and you're in your note. There are no lists or folders to manage.
- **PIN lock:** required on first use and can't be turned off. Everything is encrypted with AES-256-GCM, using a key derived from your PIN with PBKDF2. A 24-word recovery key covers a forgotten PIN, and the app locks itself after a few idle minutes.
- **Writing:**
  - Markdown with a formatting toolbar, checklists, images and lists that continue on Enter.
  - Read mode (Ctrl+E), focus and typewriter modes, and **Find in note** (Ctrl+F).
- **Never lose a word:**
  - Version history while you write, and a daily snapshot for the last 7 days.
  - Download the note as Markdown, print it or save it as PDF, and make full or encrypted backup files that you can restore from.
- **Works offline:** you can install it to the home screen or desktop. Themes, fonts, text size and page width are adjustable.

## Upgrading from the multi-note version

The first time J Notes 2 opens data from version 1 (several notes, notebooks, a diary), it does the following:

1. Saves a snapshot named **"Before the single-note update"** in Settings → Backup.
2. Combines every note and diary entry into the one note, oldest first, each under its own heading, with the diary's mood and tags kept as a line of text.
3. Leaves out notes that were in the Trash and the untouched sample "Welcome" note. They stay in that snapshot.

Your PIN keeps working. Backup files from version 1 can also be restored, and they're combined the same way.

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
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | Browser tests (Playwright, Chromium) |
| `npm run lint` | ESLint |

## Project layout

```
src/app.js          boot: storage → unlock → upgrade old data → show the note
src/lib/            storage (IndexedDB), crypto, markdown, icons, util
src/data/           state, saving + snapshots, PIN vault, backup/restore, combine (v1 → v2)
src/ui/             view (the single screen), find, format, history, lock, settings, print, modal, toast
src/styles/         CSS (design tokens and themes in base.css)
build/sw-plugin.js  generates the versioned service worker at build time
```

The code has no framework and no runtime dependencies. Data is stored in IndexedDB under `jnotes:v1`, with the same record format as before, so older backups still open.

## Deploying

`.github/workflows/ci.yml` runs lint, unit tests and browser tests on every push and pull request, and publishes `dist/` to GitHub Pages from `main`. The site carries `noindex`, so search engines don't list it.
