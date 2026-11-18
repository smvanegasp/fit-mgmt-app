// Renders the app icons (public/icon-192.png, icon-512.png, apple-touch-icon.png) from the mark in
// public/favicon.svg: a full-bleed bone square with the barbell scaled into the maskable safe zone,
// so phones can round or crop it however they like.
//
//   cd frontend && node scripts/make-icons.mjs

import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const localPath = (relative) => new URL(relative, import.meta.url).pathname.replace(/^\/(\w:)/, "$1");
const favicon = readFileSync(localPath("../public/favicon.svg"), "utf8");
const mark = favicon.match(/<g id="mark"[\s\S]*?<\/g>/)[0];
// The barbell spans 52x32 of 64 units, just past the 80% safe zone; at 0.8 around the center it fits.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="#efe9df"/>
  <g transform="translate(6.4 6.4) scale(0.8)">${mark}</g>
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
