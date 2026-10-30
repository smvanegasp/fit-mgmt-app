import { Timer, X } from "@phosphor-icons/react";

import { formatDuration } from "../lib/duration";
import { REST_CHOICES, type useRestTimer } from "../lib/restTimer";

/** Countdown between sets, pinned above the tab bar. Turns amber and counts up when rest is over. */
export function RestBar({ timer }: { timer: ReturnType<typeof useRestTimer> }) {
  if (!timer.running) return null;
  const over = timer.remaining <= 0;
  return (
    <div className="fixed inset-x-0 bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-20 px-3">
      <div
        className={`mx-auto flex max-w-lg items-center gap-3 rounded-2xl px-4 py-2.5 shadow-lg ${
          over ? "bg-amber-500 text-white" : "bg-stone-900 text-white"
        }`}
        role="timer"
        aria-live="polite"
      >
        <Timer size={22} weight="fill" aria-hidden />
        <div className="flex-1">
          <div className="text-xs opacity-80">{over ? "Rest over, next set" : "Rest"}</div>
          <div className="text-xl font-semibold tabular-nums">
            {over ? `+${formatDuration(-timer.remaining)}` : formatDuration(timer.remaining)}
          </div>
        </div>
        <label className="sr-only" htmlFor="rest-length">Rest length</label>
        <select
          id="rest-length"
          value={timer.length}
          onChange={(e) => timer.setLength(Number(e.target.value))}
          className="rounded-lg bg-white/15 px-2 py-1.5 text-sm"
        >
          {REST_CHOICES.map((s) => (
            <option key={s} value={s} className="text-stone-900">
              {formatDuration(s)}
            </option>
          ))}
        </select>
        <button type="button" onClick={timer.stop} className="rounded-full p-1.5 hover:bg-white/15" aria-label="Stop rest timer">
          <X size={20} weight="bold" aria-hidden />
        </button>
      </div>
    </div>
  );
}
