// Renders the app icons (public/icon-192.png, icon-512.png, apple-touch-icon.png) from the
// barbell in public/favicon.svg: a full-bleed blue square with the barbell inside the maskable
// safe zone, so phones can round or crop it however they like.
//
//   cd frontend && node scripts/make-icons.mjs

import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const localPath = (relative) => new URL(relative, import.meta.url).pathname.replace(/^\/(\w:)/, "$1");
const favicon = readFileSync(localPath("../public/favicon.svg"), "utf8");
const barbell = favicon.match(/<path[^>]*d="([^"]+)"/)[1];
// The glyph is 256 units wide; at 0.55 it stays well inside the 80% safe zone.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
  <rect width="256" height="256" fill="#2563eb"/>
  <path transform="translate(57.6 57.6) scale(0.55)" fill="#ffffff" d="${barbell}"/>
</svg>`;

const browser = await chromium.launch();
try {
  for (const [name, size] of [["icon-192.png", 192], ["icon-512.png", 512], ["apple-touch-icon.png", 180]]) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(`<style>html,body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
    await page.screenshot({ path: localPath(`../public/${name}`) });
    await page.close();
    console.log(`public/${name}`);
  }
} finally {
  await browser.close();
}
