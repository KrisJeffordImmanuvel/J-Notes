/* After `build` and `build:single`: name the single file J_Notes.html and ship it inside dist/ as a download. */
import { copyFileSync, existsSync } from 'node:fs';

const src = 'dist-single/index.html';
if (!existsSync(src)) { console.error('Run `npm run build:single` first.'); process.exit(1); }
copyFileSync(src, 'dist-single/J_Notes.html');
if (existsSync('dist')) copyFileSync(src, 'dist/J_Notes.html');
console.log('Single-file app: dist-single/J_Notes.html' + (existsSync('dist') ? ' (also dist/J_Notes.html)' : ''));
