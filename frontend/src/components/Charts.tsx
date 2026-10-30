import { CaretRight } from "@phosphor-icons/react";
import { useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";

import type { Group, Lift, StrengthPoint } from "../api";
import { DAY_TYPES, WEEKLY_GOAL, dayNumber, monthTicks, niceTicks, shortDate, valueText, type DayType, type Week } from "../lib/progress";
import { weekLabel } from "../lib/weeks";

// Plain SVG charts (no chart library): the strength line and the target-game dots share one x
// scale, and every chart has a readout row under it instead of a floating tooltip, which suits
// touch (tap or drag to pick a point; the latest one shows by default).

export const TYPE_COLOR: Record<DayType, string> = {
  Push: "var(--chart-push)",
  Legs: "var(--chart-legs)",
  Pull: "var(--chart-pull)",
  Cardio: "var(--chart-cardio)",
};

export function typeColor(type: string): string {
  return TYPE_COLOR[type as DayType] ?? TYPE_COLOR.Push;
}

/** A lift's line wears its day type's color (squat orange like Legs days). */
export function groupColor(group: Group | undefined): string {
  if (group === "legs" || group === "posterior") return TYPE_COLOR.Legs;
  if (group === "pull" || group === "climbing" || group === "skill") return TYPE_COLOR.Pull;
  if (group === "cardio") return TYPE_COLOR.Cardio;
  return TYPE_COLOR.Push;
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const observer = new ResizeObserver(() => setWidth(el.clientWidth));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Pick the point nearest the pointer (tap, drag, hover) or step with the arrow keys. */
function usePicker(count: number, xs: number[]) {
  const [picked, setPicked] = useState<number | null>(null);
  const index = picked !== null && picked < count ? picked : count - 1;
  function nearest(e: PointerEvent<SVGElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - box.left;
    let best = 0;
    xs.forEach((px, i) => {
      if (Math.abs(px - x) <= Math.abs(xs[best] - x)) best = i;
    });
    if (count) setPicked(best);
  }
  return {
    index,
    handlers: {
      onPointerDown: nearest,
      onPointerMove: (e: PointerEvent<SVGElement>) => {
        if (e.pointerType === "mouse" || e.buttons) nearest(e);
      },
      onKeyDown: (e: KeyboardEvent<SVGElement>) => {
        if (e.key === "ArrowLeft") setPicked(Math.max(0, index - 1));
        else if (e.key === "ArrowRight") setPicked(Math.min(count - 1, index + 1));
        else return;
        e.preventDefault();
      },
    },
  };
}

const AXIS_TEXT = "fill-stone-500 text-[10px] tabular-nums";

// ------------------------------------------------------------------ strength line + target game

const GAME_TEXT: Record<NonNullable<StrengthPoint["game"]>, string> = {
  new: "New target",
  reached: "Target reached",
  missed: "Missed the target",
  light: "Light day",
};

function GameMark({ game, x, y, color, r }: { game: StrengthPoint["game"]; x: number; y: number; color: string; r: number }) {
  if (game === "new") return <path d={`M${x},${y - r - 1} L${x + r + 0.5},${y + r - 0.5} L${x - r - 0.5},${y + r - 0.5} Z`} style={{ fill: color }} />;
  if (game === "reached") return <circle cx={x} cy={y} r={r} style={{ fill: color }} />;
  if (game === "missed") return <circle cx={x} cy={y} r={r - 0.75} className="fill-none stroke-stone-500" strokeWidth={1.5} />;
  if (game === "light") return <circle cx={x} cy={y} r={Math.max(1.5, r - 2)} className="fill-stone-400" />;
  return null;
}

/** The target-game key, shared by every strength chart. */
export function GameLegend() {
  const items: [StrengthPoint["game"], string][] = [["reached", "Reached"], ["new", "New target"], ["missed", "Missed"], ["light", "Light day"]];
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-stone-600">
      {items.map(([game, label]) => (
        <li key={label} className="flex items-center gap-1">
          <svg width={10} height={10} aria-hidden><GameMark game={game} x={5} y={5} r={4} color="var(--color-stone-600)" /></svg>
          {label}
        </li>
      ))}
      <li className="flex items-center gap-1">
        <svg width={12} height={12} aria-hidden><circle cx={6} cy={6} r={4.5} className="fill-stone-600 stroke-white" strokeWidth={2} /></svg>
        PR (ringed)
      </li>
    </ul>
  );
}

const PAD = { left: 34, right: 10, top: 8 };
const LANE = 22;
const AXIS = 16;

/** Top set per session over [from, to] (a line with ringed PR dots), the target game as one dot
 * per session under it, and a readout row for the picked session. */
export function StrengthChart({ lift, color, from, to, height = 120, onOpenWorkout }: {
  lift: Lift; color: string; from: string; to: string; height?: number; onOpenWorkout: (id: string) => void;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const points = lift.sessions.filter((p) => p.date >= from && p.date <= to);
  const x0 = dayNumber(from);
  const x1 = Math.max(dayNumber(to), x0 + 1);
  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const xOf = (day: string) => PAD.left + ((dayNumber(day) - x0) / (x1 - x0)) * plotW;
  const values = points.map((p) => p.value);
  // A minimum span (20 lb or 10%, 4 reps) so a flat stretch doesn't look like big swings.
  let [lo, hi] = values.length ? [Math.min(...values), Math.max(...values)] : [0, 1];
  const span = lift.unit === "lb" ? Math.max(20, hi * 0.1) : 4;
  if (hi - lo < span) {
    lo = Math.max(0, lo - (span - (hi - lo)) / 2);
    hi = lo + Math.max(span, hi - lo);
  }
  const ticks = niceTicks(lo, hi, 3);
  const [t0, tN] = [ticks[0], ticks.at(-1)!];
  const yOf = (v: number) => PAD.top + height - ((v - t0) / (tN - t0)) * height;
  const xs = points.map((p) => xOf(p.date));
  const { index, handlers } = usePicker(points.length, xs);
  const picked = points[index];
  const added = lift.load === "added";
  const laneY = PAD.top + height + LANE / 2 + 2;
  // Dots shrink when sessions crowd together (the "All" range).
  const gap = xs.length > 1 ? Math.min(...xs.slice(1).map((x, i) => x - xs[i])) : 20;
  const r = Math.max(2.5, Math.min(4, gap / 2 - 0.5));
  const svgH = PAD.top + height + LANE + AXIS;

  return (
    <div ref={ref}>
      {width > 0 && points.length === 0 && <p className="py-6 text-center text-sm text-stone-500">No sessions in this range.</p>}
      {width > 0 && points.length > 0 && (
        <>
          <svg
            width={width}
            height={svgH}
            role="img"
            tabIndex={0}
            aria-label={`${lift.name}: ${points.length} sessions, from ${valueText(values[0], lift.unit, added)} to ${valueText(values.at(-1)!, lift.unit, added)}. Arrow keys pick a session.`}
            className="block touch-pan-y outline-none select-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
            {...handlers}
          >
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={width - PAD.right} y1={yOf(t)} y2={yOf(t)} className="stroke-stone-200" strokeWidth={1} />
                <text x={PAD.left - 6} y={yOf(t)} dy="0.32em" textAnchor="end" className={AXIS_TEXT}>{t}</text>
              </g>
            ))}
            <line x1={PAD.left} x2={width - PAD.right} y1={laneY - LANE / 2} y2={laneY - LANE / 2} className="stroke-stone-200" strokeWidth={1} />
            <text x={PAD.left - 6} y={laneY} dy="0.32em" textAnchor="end" className={AXIS_TEXT}>Goal</text>
            {monthTicks(from, to, width < 420 ? 5 : 8).map((t) => (
              <text key={t.day} x={xOf(t.day)} y={svgH - 3} textAnchor="middle" className={AXIS_TEXT}>{t.label}</text>
            ))}
            {picked && <line x1={xs[index]} x2={xs[index]} y1={PAD.top} y2={laneY + LANE / 2} className="stroke-stone-300" strokeWidth={1} />}
            {/* Light days sit off the line as small gray dots, so a volume day doesn't read as a drop. */}
            {points.map((p, i) => p.game === "light" && i !== index && (
              <circle key={p.date} cx={xs[i]} cy={yOf(p.value)} r={3} className="fill-stone-400" />
            ))}
            <path
              d={points.map((p, i) => [p, i] as const).filter(([p]) => p.game !== "light")
                .map(([p, i], n) => `${n ? "L" : "M"}${xs[i]},${yOf(p.value)}`).join(" ")}
              fill="none"
              style={{ stroke: color }}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {points.map((p, i) => (p.pr || (i === points.length - 1 && p.game !== "light") || i === index) && (
              <circle key={p.date} cx={xs[i]} cy={yOf(p.value)} r={i === index ? 5 : 4.5}
                style={{ fill: p.game === "light" ? "var(--color-stone-400)" : color }} className="stroke-white" strokeWidth={2} />
            ))}
            {points.map((p, i) => <GameMark key={p.date} game={p.game} x={xs[i]} y={laneY} color={color} r={r} />)}
            {/* Hit area: the whole plot and lane, so the pointer only has to be near a session. */}
            <rect x={0} y={0} width={width} height={svgH} fill="transparent" />
          </svg>
          {picked && (
            <button type="button" onClick={() => onOpenWorkout(picked.workoutId)}
              className="mt-1 flex w-full items-center gap-2 rounded-lg bg-stone-50 px-2.5 py-2 text-left text-sm">
              <span className="min-w-0 flex-1">
                <span className="text-stone-500">{shortDate(picked.date)}{picked.date.slice(0, 4) !== to.slice(0, 4) ? `, ${picked.date.slice(0, 4)}` : ""} · </span>
                <span className="font-semibold">{valueText(picked.value, lift.unit, added)}</span>
                {picked.reps !== undefined && <span className="font-semibold"> × {picked.reps}</span>}
                <span className="text-stone-600"> · {picked.sets}</span>
                {lift.barLb > 0 && <span className="text-stone-500"> · {picked.value + lift.barLb} with the bar</span>}
                {picked.pr && <span className="ml-1.5 rounded bg-blue-100 px-1.5 py-0.5 text-xs font-semibold text-blue-800">PR</span>}
                {picked.game && (
                  <span className="block text-xs text-stone-500">
                    {GAME_TEXT[picked.game]}{picked.game !== "light" && picked.times !== undefined ? ` · ${picked.times} of 3` : ""}
                  </span>
                )}
              </span>
              <CaretRight size={14} className="shrink-0 text-stone-400" aria-hidden />
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ workouts per week

/** Stacked bars by day type, one per week, with the weekly goal as a line. */
export function WeeklyBars({ weeks, today }: { weeks: Week[]; today: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const height = 84;
  const left = 22;
  const right = 4;
  const top = 6;
  const plotW = Math.max(0, width - left - right);
  const band = weeks.length ? plotW / weeks.length : 0;
  const bar = Math.max(2, Math.min(24, band - 2));
  const ticks = niceTicks(0, Math.max(WEEKLY_GOAL + 1, ...weeks.map((w) => w.total)), 3);
  const top0 = ticks.at(-1)!;
  const yOf = (v: number) => top + height - (v / top0) * height;
  const xs = weeks.map((_, i) => left + band * i + band / 2);
  const { index, handlers } = usePicker(weeks.length, xs);
  const picked = weeks[index];
  const svgH = top + height + AXIS;
  const months = weeks.length ? monthTicks(weeks[0].monday, weeks.at(-1)!.monday, width < 420 ? 5 : 8) : [];

  return (
    <div ref={ref}>
      {width > 0 && weeks.length > 0 && (
        <>
          <svg width={width} height={svgH} role="img" tabIndex={0}
            aria-label={`Workouts per week, ${weeks.length} weeks, goal ${WEEKLY_GOAL}. Arrow keys pick a week.`}
            className="block touch-pan-y outline-none select-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded" {...handlers}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={left} x2={width - right} y1={yOf(t)} y2={yOf(t)} className="stroke-stone-200" strokeWidth={1} />
                <text x={left - 6} y={yOf(t)} dy="0.32em" textAnchor="end" className={AXIS_TEXT}>{t}</text>
              </g>
            ))}
            {weeks.map((w, i) => {
              const x = xs[i] - bar / 2;
              let base = 0;
              const types = DAY_TYPES.filter((t) => w.counts[t] > 0);
              return (
                <g key={w.monday} opacity={i === index ? 1 : 0.85}>
                  {types.map((t, j) => {
                    const y1 = yOf(base);
                    base += w.counts[t];
                    const y2 = yOf(base);
                    // 2px surface gap between stacked segments; the top one gets rounded corners.
                    if (j < types.length - 1) {
                      return <rect key={t} x={x} y={y2 + 2} width={bar} height={Math.max(1, y1 - y2 - 2)} style={{ fill: TYPE_COLOR[t] }} />;
                    }
                    const rr = Math.min(3, bar / 2, y1 - y2);
                    return (
                      <path key={t} style={{ fill: TYPE_COLOR[t] }}
                        d={`M${x},${y1} V${y2 + rr} Q${x},${y2} ${x + rr},${y2} H${x + bar - rr} Q${x + bar},${y2} ${x + bar},${y2 + rr} V${y1} Z`} />
                    );
                  })}
                </g>
              );
            })}
            <line x1={left} x2={width - right} y1={yOf(WEEKLY_GOAL)} y2={yOf(WEEKLY_GOAL)} className="stroke-stone-500" strokeWidth={1} />
            {picked && <rect x={xs[index] - band / 2} y={top} width={band} height={height} className="fill-stone-400" opacity={0.12} />}
            {months.map((t) => (
              <text key={t.day} x={left + band * Math.round((dayNumber(t.day) - dayNumber(weeks[0].monday)) / 7) + band / 2} y={svgH - 3}
                textAnchor="middle" className={AXIS_TEXT}>{t.label}</text>
            ))}
            <rect x={0} y={0} width={width} height={svgH} fill="transparent" />
          </svg>
          {picked && (
            <p className="mt-1 rounded-lg bg-stone-50 px-2.5 py-2 text-sm">
              <span className="text-stone-500">{weekLabel(picked.monday, today)} · </span>
              <span className="font-semibold">{picked.total} {picked.total === 1 ? "workout" : "workouts"}</span>
              {picked.total > 0 && (
                <span className="text-stone-600"> · {DAY_TYPES.filter((t) => picked.counts[t]).map((t) => `${t} ${picked.counts[t]}`).join(", ")}</span>
              )}
            </p>
          )}
        </>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ legend

export function TypeLegend({ children }: { children?: ReactNode }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-600">
      {DAY_TYPES.map((t) => (
        <li key={t} className="flex items-center gap-1">
          <span className="size-2.5 rounded-[3px]" style={{ background: TYPE_COLOR[t] }} aria-hidden />
          {t}
        </li>
      ))}
      {children}
    </ul>
  );
}
