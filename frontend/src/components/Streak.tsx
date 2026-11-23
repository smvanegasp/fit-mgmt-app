import { CaretRight, Check, Fire, ShieldCheck } from "@phosphor-icons/react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { GOAL, SHIELD_EVERY } from "../lib/progress";
import { daysLeftText, milestoneAt, milestoneBand, streakStatus, type WeekSlot } from "../lib/streak";
import { InfoTip } from "./InfoTip";
import { useGoTo } from "./Nav";
import { typeColor } from "./Progression";

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
  // On a milestone, the band shown is the one just finished (from the milestone before): all banked.
  const total = complete ? weeks - milestoneAt(weeks - 1) : band.total;
  const filled = complete ? total : band.filled;
  const to = complete ? weeks : band.to;
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

/** This week's goal as slots: three strength days and the cardio day, filled as they're trained. */
function WeekSlots({ slots }: { slots: WeekSlot[] }) {
  return (
    <ol className="grid grid-cols-4 gap-1.5" aria-label="This week's goal">
      {slots.map((slot, i) => (
        <li key={i}
          aria-label={`${slot.type}${slot.done ? ", done" : ", to do"}`}
          style={slot.done ? { borderColor: typeColor(slot.type) } : undefined}
          className={`relative flex h-12 flex-col items-center justify-center overflow-hidden rounded-[3px] border ${slot.done ? "bg-stone-100" : "border-dashed border-stone-300"}`}>
          {slot.done && <span aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ background: typeColor(slot.type) }} />}
          {slot.done
            ? <Check size={16} weight="bold" style={{ color: typeColor(slot.type) }} aria-hidden />
            : <span aria-hidden className="h-4" />}
          <span className={`text-[0.65rem] font-semibold tracking-[0.12em] uppercase ${slot.done ? "text-stone-800" : "text-stone-400"}`}>
            {slot.type}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** "1 shield" with the shield icon, or how far the first one is. */
function Shields({ shields, toShield }: { shields: number; toShield: number }) {
  return (
    <p className="flex items-center gap-1.5 text-xs text-stone-500 tabular-nums">
      <ShieldCheck size={16} weight="fill" className={shields > 0 ? "text-sky-600" : "text-stone-300"} aria-hidden />
      {shields > 0 && <span className="font-semibold text-stone-800">{shields} shield{shields === 1 ? "" : "s"} ·</span>}
      {toShield} more week{toShield === 1 ? "" : "s"} to {shields > 0 ? "another" : "a shield"}
    </p>
  );
}

/**
 * The streak, up front on Train (Sergio, 2026-11-17: they open the app there, and seeing the run
 * going is what gets them started). The run and its shields, this week as the goal's slots (the
 * week runs Monday to Sunday), then the next milestone. Opens Progress, where every week is.
 */
export function StreakCard({ days, today }: { days: Day[]; today: string }) {
  const goTo = useGoTo();
  const s = streakStatus(days, today);
  const toGo = s.band.to - s.current;
  return (
    <section aria-label="Streak" className={`rounded-2xl border bg-white p-4 ${s.atRisk ? "border-amber-400" : "border-stone-200"}`}>
      <div className="flex items-center gap-3">
        <span className="font-display text-6xl leading-none font-bold text-blue-600 tabular-nums">{s.current}</span>
        <span className="flex min-w-0 flex-col">
          <span className="flex items-center gap-1.5 text-sm font-semibold tracking-wide text-stone-700 uppercase">
            <Fire size={14} weight="fill" className="shrink-0 text-blue-600" aria-hidden /> week streak
            <InfoTip title="Streak">
              Weeks in a row (Monday to Sunday) that reached the goal: {GOAL.strength} strength days and {GOAL.cardio} cardio
              day. This week adds one as soon as its goal is reached, and can't break the streak until Sunday is over. Every{" "}
              {SHIELD_EVERY} weeks of the streak earn a shield: a week that misses the goal uses one up instead of ending the
              streak. The squares are the weeks toward the next milestone.
            </InfoTip>
          </span>
          <span className="text-xs text-stone-500 tabular-nums">longest {s.longest} weeks</span>
        </span>
        {s.shields > 0 && (
          <span className="ml-auto flex shrink-0 items-center gap-1 rounded-[3px] border border-sky-600 px-2 py-1 text-sm font-semibold text-sky-700 tabular-nums"
            aria-label={`${s.shields} shield${s.shields === 1 ? "" : "s"}`}>
            <ShieldCheck size={16} weight="fill" aria-hidden /> {s.shields}
          </span>
        )}
      </div>

      <div className="mt-4 border-t border-stone-200 pt-3">
        <div className="mb-2 flex items-baseline gap-2 text-xs font-semibold tracking-wide text-stone-500 uppercase">
          This week <span className="font-normal tracking-normal normal-case">Mon–Sun</span>
          <span className={`ml-auto font-normal tracking-normal normal-case ${s.atRisk ? "text-amber-500" : ""}`}>
            {s.week.met ? "goal reached" : daysLeftText(s.week.daysLeft)}
          </span>
        </div>
        <WeekSlots slots={s.slots} />
      </div>

      <div className="mt-4 border-t border-stone-200 pt-3">
        <div className="mb-2 flex items-baseline gap-2 text-xs font-semibold tracking-wide text-stone-500 uppercase">
          {s.onMilestone ? `${s.current} weeks reached` : `Next: ${s.band.to} weeks`}
          <span className="ml-auto font-normal tracking-normal normal-case tabular-nums">
            {s.onMilestone ? `next ${s.band.to}` : `${toGo} week${toGo === 1 ? "" : "s"} to go`}
          </span>
        </div>
        <StreakLadder weeks={s.current} complete={s.onMilestone} label={false} />
        <div className="mt-3 flex items-center gap-2">
          <Shields shields={s.shields} toShield={s.toShield} />
          <button type="button" onClick={() => goTo("progress")}
            className="-my-1 ml-auto flex shrink-0 items-center gap-0.5 rounded px-1 py-1 text-xs font-medium text-stone-500">
            Every week <CaretRight size={12} aria-hidden />
          </button>
        </div>
      </div>
    </section>
  );
}

/**
 * The congrats for crossing a streak milestone or earning a shield: the same hit as a crushed
 * target — the flash, the one hard shake, the buzz — but for a run of weeks instead of one set.
 */
export function StreakCelebration({ weeks, shield = false, onClose }: { weeks: number; shield?: boolean; onClose: () => void }) {
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
        {shield ? (
          <>
            <p className="text-xs font-semibold tracking-[0.2em] text-stone-500 uppercase">Shield earned</p>
            <ShieldCheck size={88} weight="fill" className="mx-auto mt-3 text-sky-600" aria-hidden />
            <p className="mt-2 font-display text-2xl font-bold">{weeks} weeks in a row</p>
            <p className="mt-3 text-sm text-stone-600">
              A week that misses the goal will use it up instead of ending the streak.
            </p>
          </>
        ) : (
          <>
            <p className="text-xs font-semibold tracking-[0.2em] text-stone-500 uppercase">Streak milestone</p>
            <p className="mt-3 font-display text-7xl leading-none font-bold text-blue-600 tabular-nums">{weeks}</p>
            <p className="mt-2 font-display text-2xl font-bold">weeks in a row</p>
            <StreakLadder weeks={weeks} complete label={false} className="mt-4 justify-center" />
            <p className="mt-3 text-sm text-stone-600">Goal met {weeks} weeks running. Next: {next}.</p>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
