import { CaretRight, Check } from "@phosphor-icons/react";
import { useState } from "react";

import type { Group, Lift, Load, Scheme, Step } from "../api";
import { DAY_TYPES, stepDates, type DayType } from "../lib/progress";
import { schemeText } from "../lib/sets";
import { InfoTip } from "./InfoTip";

export const TYPE_COLOR: Record<DayType, string> = {
  Push: "var(--chart-push)",
  Legs: "var(--chart-legs)",
  Pull: "var(--chart-pull)",
  Cardio: "var(--chart-cardio)",
};

export function typeColor(type: string): string {
  return TYPE_COLOR[type as DayType] ?? TYPE_COLOR.Push;
}

/** An exercise wears its day type's color (squat orange like Legs days). */
export function groupColor(group: Group | undefined): string {
  if (group === "legs" || group === "posterior") return TYPE_COLOR.Legs;
  if (group === "pull" || group === "climbing" || group === "skill") return TYPE_COLOR.Pull;
  if (group === "cardio") return TYPE_COLOR.Cardio;
  return TYPE_COLOR.Push;
}

export function TypeLegend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-600">
      {DAY_TYPES.map((t) => (
        <li key={t} className="flex items-center gap-1">
          <span className="size-2.5 rounded-[3px]" style={{ background: TYPE_COLOR[t] }} aria-hidden />
          {t}
        </li>
      ))}
    </ul>
  );
}

// ------------------------------------------------------------------ the set glyph

const CELL = 5;
const GAP = 1.5;

/** A target drawn as sets side by side, each a stack of reps: 5×4 is five columns of four
 * squares, so more sets read as wider and more reps as taller. Long sets (holds in seconds,
 * high reps) become bars. `max` keeps glyphs of one exercise on the same scale. */
export function SetGlyph({ sets, max, color, faded = false }: { sets: number[]; max: number; color: string; faded?: boolean }) {
  const squares = max <= 8;
  const height = squares ? max * (CELL + GAP) - GAP : 36;
  const width = sets.length * (CELL + 2) - 2;
  return (
    <svg width={width} height={height} aria-hidden className="shrink-0" style={{ opacity: faded ? "var(--glyph-faded)" : 1 }}>
      {sets.map((reps, i) => {
        const x = i * (CELL + 2);
        if (!squares) {
          const h = Math.max(2, (reps / max) * height);
          return <rect key={i} x={x} y={height - h} width={CELL} height={h} rx={1.5} style={{ fill: color }} />;
        }
        return Array.from({ length: Math.ceil(reps) }, (_, r) => {
          const part = Math.min(1, reps - r);
          const h = CELL * part;
          return <rect key={`${i}-${r}`} x={x} y={height - r * (CELL + GAP) - h} width={CELL} height={h} rx={1} style={{ fill: color }} />;
        });
      })}
    </svg>
  );
}

function glyphMax(steps: { scheme: Scheme }[]): number {
  return Math.max(1, ...steps.flatMap((s) => s.scheme.sets));
}

/** The target game's count as three dots (filled = reached). */
export function GameDots({ times, goal = 3, color = "var(--color-blue-600)" }: { times: number; goal?: number; color?: string }) {
  return (
    <span className="inline-flex gap-1" role="img" aria-label={`${Math.min(times, goal)} of ${goal} in a row`}>
      {Array.from({ length: goal }, (_, i) => (
        <span key={i} className="size-2.5 rounded-full border-2" style={{ borderColor: color, background: i < times ? color : "transparent" }} />
      ))}
    </span>
  );
}

// ------------------------------------------------------------------ the progression ladder

/** Progress tab: the last few targets left to right, the current one in full color. */
export function LadderStrip({ lift, color, count = 6 }: { lift: Lift; color: string; count?: number }) {
  const steps = lift.steps.slice(-count);
  const max = glyphMax(lift.steps);
  return (
    <div className="flex items-end gap-3 overflow-hidden">
      {steps.map((s, i) => {
        const current = i === steps.length - 1;
        return (
          <div key={i} className="flex flex-col items-center gap-1">
            <SetGlyph sets={s.scheme.sets} max={max} color={color} faded={!current} />
            <span className={`text-[11px] tabular-nums ${current ? "font-semibold text-stone-900" : "text-stone-500"}`}>
              {s.scheme.weightLb ?? "BW"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Exercise page: every target, newest first. The top row is the current target and its count;
 * each session is a dot (filled = reached, ring = missed) that opens the workout. */
export function ProgressionLadder({ lift, color, load, today, onOpenWorkout }: {
  lift: Lift; color: string; load: Load; today: string; onOpenWorkout: (id: string) => void;
}) {
  const [all, setAll] = useState(false);
  const steps = [...lift.steps].reverse();
  const shown = all ? steps : steps.slice(0, 5);
  const max = glyphMax(lift.steps);
  if (steps.length === 0) return null;
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-4">
      <h2 className="flex items-center gap-1 font-semibold">
        Progression
        <InfoTip title="Progression">
          Each row is a target you worked on, newest first. Columns are sets and squares are reps, so you can see the sets
          and reps grow before the weight goes up. Dots are sessions: filled reached it, a ring missed it; tap one to open
          it. Reach a target 3 times in a row, then go up. Light days aren't listed.
        </InfoTip>
      </h2>
      <ol className="mt-2 space-y-1">
        {shown.map((step, i) => {
          const current = i === 0;
          return (
            <li key={step.sessions[0].date} className={`flex items-center gap-3 rounded-xl px-2 py-2 ${current ? "bg-blue-50" : ""}`}>
              <div className="flex w-12 shrink-0 justify-center"><SetGlyph sets={step.scheme.sets} max={max} color={color} /></div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">
                  {schemeText(step.scheme, load)}
                  {current && <span className="ml-1.5 text-xs font-medium text-blue-800">now</span>}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-stone-500">
                  {stepDates(step, today)}
                  <SessionDots step={step} color={color} onOpen={onOpenWorkout} />
                </div>
              </div>
              <div className="shrink-0 text-xs">
                {current ? (
                  <GameDots times={step.times} />
                ) : step.times >= 3 ? (
                  <span className="inline-flex items-center gap-0.5 font-medium text-stone-700"><Check size={14} weight="bold" aria-hidden /> 3 of 3</span>
                ) : (
                  <span className="text-stone-500">{step.times} of 3</span>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      {steps.length > 5 && (
        <button type="button" onClick={() => setAll(!all)} className="mt-1 w-full py-2 text-sm font-medium text-blue-700">
          {all ? "Show fewer" : `Show all ${steps.length} targets`}
        </button>
      )}
    </section>
  );
}

function SessionDots({ step, color, onOpen }: { step: Step; color: string; onOpen: (id: string) => void }) {
  return (
    <span className="inline-flex">
      {step.sessions.map((s) => (
        // A 20px tap target around an 8px dot.
        <button key={s.date} type="button" onClick={() => onOpen(s.workoutId)} className="grid size-5 place-items-center"
          aria-label={`${s.date}: ${s.result === "missed" ? "missed" : "reached"}`}>
          <span className="size-2 rounded-full border-[1.5px]" style={{ borderColor: color, background: s.result === "missed" ? "transparent" : color }} />
        </button>
      ))}
    </span>
  );
}

/** A lift on the Progress tab: name (opens its page), the current target and count, and the
 * last few targets as glyphs. */
export function LiftCard({ lift, color, load, onOpen }: { lift: Lift; color: string; load: Load; onOpen: () => void }) {
  const current = lift.steps.at(-1);
  return (
    <button type="button" onClick={onOpen} className="block w-full rounded-2xl border border-stone-200 bg-white p-4 text-left">
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 font-semibold">{lift.name}</span>
        <CaretRight size={14} className="shrink-0 text-stone-400" aria-hidden />
      </div>
      {current ? (
        <>
          <div className="mt-0.5 flex items-center gap-2 text-sm text-stone-600">
            <span>Target {schemeText(current.scheme, load)}</span>
            <GameDots times={current.times} />
          </div>
          <div className="mt-3"><LadderStrip lift={lift} color={color} /></div>
        </>
      ) : (
        <p className="mt-1 text-sm text-stone-500">Not done yet.</p>
      )}
    </button>
  );
}
