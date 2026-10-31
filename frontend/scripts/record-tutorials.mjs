// Records the short looping tutorial clips shown on the welcome page (adapted from the pantry).
//
//   docker compose up -d          # the app must be running
//   cd frontend && npm run record-tutorials [-- http://localhost:5180]
//
// Each clip runs in its own throwaway demo sandbox seeded with the sample log, so the owner's
// log is never touched. Needs ffmpeg on PATH. Writes public/tutorials/<id>.mp4 and a poster
// image <id>.jpg.

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, renameSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:5180";
const localPath = (relative) => new URL(relative, import.meta.url).pathname.replace(/^\/(\w:)/, "$1");
const OUT = localPath("../public/tutorials/");
const VIEWPORT = { width: 390, height: 844 };
// Pauses are written for a comfortable pace, then shortened by PACE; the encode then plays
// back at SPEED. Together they keep clips brisk without skipping any steps.
const PACE = 0.75;
const SPEED = 1.2;

// Shows a fading dot wherever the "finger" taps, and hides the demo banner.
const TAP_OVERLAY = () => {
  addEventListener("DOMContentLoaded", () => {
    const style = document.createElement("style");
    style.textContent = `
      [data-demo-banner] { display: none !important; }
      .tap-dot { position: fixed; z-index: 9999; width: 44px; height: 44px; margin: -22px 0 0 -22px;
        border-radius: 50%; background: rgba(37, 99, 235, .35); border: 2px solid rgba(37, 99, 235, .8);
        pointer-events: none; animation: tap .6s ease-out forwards; }
      @keyframes tap { from { transform: scale(.4); opacity: 1 } to { transform: scale(1.2); opacity: 0 } }`;
    document.head.append(style);
  });
  addEventListener(
    "pointerdown",
    (e) => {
      const dot = document.createElement("div");
      dot.className = "tap-dot";
      dot.style.left = `${e.clientX}px`;
      dot.style.top = `${e.clientY}px`;
      document.body.append(dot);
      setTimeout(() => dot.remove(), 700);
    },
    true,
  );
};

const pause = (page, ms = 700) => page.waitForTimeout(ms * PACE);
const tap = async (page, locator, ms = 700) => {
  await locator.click();
  await pause(page, ms);
};
const tab = (page, name) => page.getByRole("button", { name, exact: true });
const scroll = async (page, steps, by = 140) => {
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, by);
    await pause(page, 130);
  }
};

/** Opens the app and waits until the first screen is drawn; the clip starts here. */
async function open(page, ready) {
  await page.goto(BASE);
  await ready.waitFor();
  await pause(page, 300);
  page.clipStart = Date.now();
}

const CLIPS = [
  {
    id: "log",
    async run(page) {
      await open(page, page.getByRole("button", { name: /^Start .* workout$/ }));
      await pause(page, 800);
      await tap(page, page.getByRole("button", { name: /^Start .* workout$/ }), 1000);
      await tap(page, page.getByRole("button", { name: "Add exercise" }), 900);
      await tap(page, page.getByRole("button", { name: /^Weighted dips/ }).first(), 1600);
      await tap(page, page.getByRole("button", { name: "Log set 1" }), 900);
      await tap(page, page.getByRole("button", { name: "Log set 2" }), 900);
      await tap(page, page.getByRole("button", { name: "Log set 3" }), 1600);
    },
  },
  {
    id: "progress",
    async run(page) {
      await open(page, tab(page, "Progress"));
      await tap(page, tab(page, "Progress"), 1400);
      await scroll(page, 6);
      await pause(page, 900);
      await tap(page, page.getByRole("button", { name: /^Back squat/ }), 1800);
      await scroll(page, 2);
      await pause(page, 1400);
    },
  },
  {
    id: "history",
    async run(page) {
      await open(page, tab(page, "History"));
      await tap(page, tab(page, "History"), 1100);
      await tap(page, page.getByRole("radio", { name: "Legs" }), 1000);
      await tap(page, page.locator("ul li button").first(), 1600);
      await scroll(page, 2);
      await pause(page, 1400);
    },
  },
];

async function record(browser, clip, workDir) {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    // Playwright records the viewport 1:1 (a larger size just adds gray padding).
    recordVideo: { dir: workDir, size: VIEWPORT },
    colorScheme: "light",
  });
  const started = Date.now();
  await context.addInitScript(TAP_OVERLAY);
  const page = await context.newPage();
  await page.request.fetch(`${BASE}/api/session/guest/reset?sample=true`, { method: "POST" });
  try {
    await clip.run(page);
  } catch (err) {
    const shot = join(OUT, `${clip.id}-failed.png`);
    await page.screenshot({ path: shot });
    // Release the video file, or cleaning up the work folder fails and hides this error.
    await context.close();
    throw new Error(`Clip "${clip.id}" failed (screenshot: ${shot}): ${err.message}`);
  }
  // Setup and page loading are trimmed off: the clip starts on a fully drawn screen.
  const trimStart = (page.clipStart - started) / 1000;
  const video = page.video();
  await context.close();
  const raw = join(workDir, `${clip.id}.webm`);
  renameSync(await video.path(), raw);
  return { raw, trimStart };
}

function encode(id, raw, trimStart) {
  const mp4 = join(OUT, `${id}.mp4`);
  const poster = join(OUT, `${id}.jpg`);
  const ffmpeg = (...args) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args]);
  ffmpeg("-ss", String(trimStart), "-i", raw, "-vf", `setpts=PTS/${SPEED},fps=30`, "-c:v", "libx264",
    // Short keyframe interval keeps looping and starting playback smooth on phones.
    "-preset", "slow", "-crf", "26", "-g", "30", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", mp4);
  ffmpeg("-ss", "0.8", "-i", mp4, "-frames:v", "1", "-q:v", "4", poster);
  return mp4;
}

mkdirSync(OUT, { recursive: true });
const workDir = mkdtempSync(join(tmpdir(), "gym-tutorials-"));
const browser = await chromium.launch();
try {
  for (const clip of CLIPS) {
    process.stdout.write(`Recording ${clip.id}… `);
    const { raw, trimStart } = await record(browser, clip, workDir);
    console.log(`-> ${encode(clip.id, raw, trimStart)}`);
  }
} finally {
  await browser.close();
  if (process.env.KEEP_RAW) console.log(`Raw recordings kept in ${workDir}`);
  else rmSync(workDir, { recursive: true, force: true });
}
