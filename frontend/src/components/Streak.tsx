import { CaretRight, Fire } from "@phosphor-icons/react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { daysLeftText, milestoneBand, streakStatus } from "../lib/streak";
import { useGoTo } from "./Nav";

const SHOW_MS = 3600;

type Day = { date: string; type?: string; cardio?: boolean };

/**
 * The band being climbed as one square per week: banked weeks in the goal's red, the rest as
 * rings. `spread` pushes the milestone to the far right so the row uses the card's full width;
 * past a year the band is too wide for squares, so it becomes a bar.
 */
export function StreakLadder({ weeks, className = "", spread = false, label = true, complete = false }: {
  weeks: number; className?: string; spread?: boolean; label?: boolean; complete?: boolean;
}) {
  const band = milestoneBand(weeks);
  const { total, to } = band;
  // On a milestone, the band shown is the one just finished: every week of it banked.
  const filled = complete ? total : band.filled;
  const tag = label ? (
    <span className={`${spread ? "ml-auto" : "ml-1"} shrink-0 text-xs text-stone-500 tabular-nums`}>{to} wks</span>
  ) : null;

  if (total > 16) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <span className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-[2px] bg-stone-200" aria-hidden>
          <span className="block h-full bg-blue-600" style={{ width: `${(filled / total) * 100}%` }} />
        </span>
        {tag}
      </div>
    );
  }
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} aria-hidden className={`size-3 rounded-[2px] border ${i < filled ? "border-blue-600 bg-blue-600" : "border-stone-300"}`} />
      ))}
      {tag}
    </div>
  );
}

/**
 * The streak, up front on Train (Sergio, 2026-11-17: they open the app there, and seeing the run
 * going is what gets them started). The number and how far it has to go to the next milestone,
 * then what this week still needs to keep it. Opens Progress, where the week-by-week detail lives.
 */
export function StreakCard({ days, today }: { days: Day[]; today: string }) {
  const goTo = useGoTo();
  const s = streakStatus(days, today);
  return (
    <button
      type="button"
      onClick={() => goTo("progress")}
      className={`block w-full rounded-2xl border bg-white p-4 text-left ${s.atRisk ? "border-amber-400" : "border-stone-200"}`}
    >
      <div className="flex items-center gap-3">
        <span className="font-display text-6xl leading-none font-bold text-blue-600 tabular-nums">{s.current}</span>
        <span className="flex items-center gap-1.5 text-sm font-semibold tracking-wide text-stone-700 uppercase">
          <Fire size={14} weight="fill" className="shrink-0 text-blue-600" aria-hidden /> week streak
        </span>
        <span className="ml-auto shrink-0 text-right text-xs text-stone-500 tabular-nums">longest {s.longest} weeks</span>
      </div>
      <StreakLadder weeks={s.current} spread className="mt-4 border-t border-stone-200 pt-3" />
      <p className={`mt-2 flex items-center gap-1 text-sm ${s.atRisk ? "text-amber-500" : "text-stone-500"}`}>
        <span className="min-w-0 flex-1">
          {s.week.met ? "This week's goal is reached" : `${s.week.text} · ${daysLeftText(s.week.daysLeft)}`}
        </span>
        <CaretRight size={14} className="shrink-0 text-stone-400" aria-hidden />
      </p>
    </button>
  );
}

/**
 * The congrats for crossing a streak milestone: the same hit as a crushed target — the flash, the
 * one hard shake, the buzz — but for a run of weeks instead of one set.
 */
export function StreakCelebration({ weeks, onClose }: { weeks: number; onClose: () => void }) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    navigator.vibrate?.([30, 50, 80, 50, 120]);
    const id = setTimeout(() => close.current(), SHOW_MS);
    return () => clearTimeout(id);
  }, []);

  const next = milestoneBand(weeks).to;

  return createPortal(
    <div role="status" aria-live="polite" onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 motion-safe:animate-[fade-in_120ms_ease-out]">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-blue-600 opacity-0 motion-safe:animate-[flash_450ms_ease-out]" />
      <div className="relative w-full max-w-xs border border-blue-600 bg-white px-6 py-7 text-center shadow-[0_0_60px_-10px_var(--ember-glow)] motion-safe:animate-[pop-in_260ms_cubic-bezier(.2,1.4,.4,1),breakdown_520ms_260ms_ease-out]">
        <p className="text-xs font-semibold tracking-[0.2em] text-stone-500 uppercase">Streak milestone</p>
        <p className="mt-3 font-display text-7xl leading-none font-bold text-blue-600 tabular-nums">{weeks}</p>
        <p className="mt-2 font-display text-2xl font-bold">weeks in a row</p>
        <StreakLadder weeks={weeks} complete label={false} className="mt-4 justify-center" />
        <p className="mt-3 text-sm text-stone-600">Goal met {weeks} weeks running. Next: {next}.</p>
      </div>
    </div>,
    document.body,
  );
}
