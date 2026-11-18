import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import type { Load, Scheme } from "../api";
import { schemeText } from "../lib/sets";
import { GameDots } from "./Progression";

const SHOW_MS = 3200;

/**
 * The congrats when a set reaches the target (Sergio, 2026-11-03: mainly for the first, heavy
 * lift). The logo's ladder builds square by square, then the count. Closes by itself or on a tap;
 * no motion with "reduce motion" on.
 */
export function Celebration({ scheme, load, times, goal, onClose }: {
  scheme: Scheme; load: Load; times: number; goal: number; onClose: () => void;
}) {
  // Once per congrats, even if the card behind re-renders (onClose is a new function each time).
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    navigator.vibrate?.([30, 50, 80]);
    const id = setTimeout(() => close.current(), SHOW_MS);
    return () => clearTimeout(id);
  }, []);

  const done = times >= goal;
  // The logo's ladder: columns of 2, 3 and 4 squares, built bottom-up, left to right.
  const columns = [2, 3, 4];
  let order = 0;

  // On the page itself, so it covers the tabs too.
  return createPortal(
    <div role="status" aria-live="polite" onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 motion-safe:animate-[fade-in_120ms_ease-out]">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-blue-600 opacity-0 motion-safe:animate-[flash_450ms_ease-out]" />
      <div className="w-full max-w-xs relative border border-blue-600 bg-white px-6 py-7 text-center shadow-[0_0_60px_-10px_var(--ember-glow)] motion-safe:animate-[pop-in_260ms_cubic-bezier(.2,1.4,.4,1),breakdown_520ms_260ms_ease-out]">
        <div className="mx-auto flex h-24 items-end justify-center gap-2" aria-hidden>
          {columns.map((height, c) => (
            <div key={c} className="flex flex-col-reverse gap-1.5">
              {Array.from({ length: height }, () => {
                const delay = 120 + order++ * 55;
                return (
                  <span key={delay} style={{ animationDelay: `${delay}ms` }}
                    className="block size-4 bg-blue-600 motion-safe:animate-[square-in_260ms_ease-out_both]" />
                );
              })}
            </div>
          ))}
        </div>
        <p className="mt-5 font-display text-4xl font-bold">{done ? `${times} in a row` : "Target crushed"}</p>
        <p className="mt-1 text-stone-600">{schemeText(scheme, load)}</p>
        <div className="mt-3 flex items-center justify-center gap-2 text-sm text-stone-600">
          <GameDots times={times} goal={goal} />
          {done ? "Time to go up next time" : `${times} of ${goal} in a row`}
        </div>
      </div>
    </div>,
    document.body,
  );
}
