import { useEffect, useState } from "react";

import { Logo } from "./Logo";

const FADE_MS = 280;

/**
 * The first load (Sergio, 2026-11-23: the page and the tabs looked broken while the data came in):
 * the mark over a blurred page with a running bar, covering everything, tabs included, until
 * `ready`; then it fades out and leaves.
 */
export function Splash({ ready }: { ready: boolean }) {
  const [gone, setGone] = useState(false);
  useEffect(() => {
    if (!ready) return;
    const id = setTimeout(() => setGone(true), FADE_MS);
    return () => clearTimeout(id);
  }, [ready]);
  if (gone) return null;
  return (
    <div role="status" aria-live="polite" aria-label="Loading"
      className={`fixed inset-0 z-[70] flex flex-col items-center justify-center gap-6 bg-stone-50/95 backdrop-blur-xl transition-opacity duration-300 ${ready ? "pointer-events-none opacity-0" : "opacity-100"}`}>
      <Logo size={72} />
      <div className="h-1 w-40 overflow-hidden rounded-full bg-stone-200" aria-hidden>
        <div className="h-full w-1/3 rounded-full bg-blue-600 motion-safe:animate-[splash-bar_1.1s_ease-in-out_infinite]" />
      </div>
    </div>
  );
}
