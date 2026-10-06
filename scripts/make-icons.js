/* Renders the PNG app icons from public/icons/icon.svg with headless Chromium. Run: npm run icons */
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';

const svg = readFileSync('public/icons/icon.svg', 'utf8');
// Maskable icons need the artwork inside the central 80% "safe zone", on a full-bleed background.
const maskable = svg.replace('rx="112"', 'rx="0"').replace('font-size="320"', 'font-size="250"').replace('y="368"', 'y="345"');
const out = [
  ['public/icons/icon-192.png', 192, svg], ['public/icons/icon-512.png', 512, svg],
  ['public/icons/maskable-512.png', 512, maskable], ['public/icons/apple-touch-icon.png', 180, maskable]
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [file, size, art] of out) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${art}`);
  await page.screenshot({ path: file, omitBackground: true });
  console.log('wrote', file);
}
await browser.close();
