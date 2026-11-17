import { useEffect, useRef, useState } from "react";

import type { Point } from "../lib/series";
import { friendlyDate } from "../lib/time";

const HEIGHT = 160;
const PAD = { top: 16, right: 12, bottom: 22, left: 36 };
const DAY = 86_400_000;

const time = (date: string) => new Date(`${date}T12:00:00`).getTime();
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** About 3 round numbers covering the values, with a little room above and below. */
function yTicks(min: number, max: number): number[] {
  const span = Math.max(max - min, 1);
  const raw = span / 3;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const low = Math.floor(min / step) * step;
  const ticks = [];
  for (let v = low; v <= max + step * 0.5; v += step) ticks.push(Math.round(v * 100) / 100);
  return ticks.length > 1 ? ticks : [low, low + step];
}

/** Month starts across the range, thinned to fit ("Sep", "Jan 26"). */
function xTicks(from: number, to: number, width: number): { at: number; label: string }[] {
  const months: { at: number; label: string }[] = [];
  const d = new Date(from);
  d.setDate(1);
  d.setMonth(d.getMonth() + 1);
  while (d.getTime() <= to) {
    const m = d.getMonth();
    months.push({ at: d.getTime(), label: m === 0 ? `Jan ${String(d.getFullYear()).slice(2)}` : MONTHS[m] });
    d.setMonth(m + 1);
  }
  const every = Math.max(1, Math.ceil(months.length / Math.max(1, Math.floor(width / 64))));
  return months.filter((_, i) => i % every === 0);
}

/**
 * One series over time as a 2px line (dataviz skill: thin marks, recessive grid, the last value
 * labeled, a crosshair that snaps to the nearest session, the same readout on arrow keys, and a
 * table view). The title outside names the series, so there's no legend.
 */
export function LineChart({ points, format, color, label, onOpen, noun = "sessions" }: {
  points: Point[];
  format: (value: number) => string;
  color: string;
  /** For screen readers: what's plotted. */
  label: string;
  /** What each point is, for screen readers ("sessions", "weigh-ins"). */
  noun?: string;
  /** Tapping a point opens its workout. */
  onOpen?: (workoutId: string) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([e]) => setWidth(Math.max(200, e.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const values = points.map((p) => p.value);
  const ticks = yTicks(Math.min(...values), Math.max(...values));
  const yMin = ticks[0];
  const yMax = ticks.at(-1)!;
  const from = time(points[0].date);
  const to = Math.max(time(points.at(-1)!.date), from + DAY);
  const plotW = width - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const x = (date: string) => PAD.left + ((time(date) - from) / (to - from)) * plotW;
  const y = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin || 1)) * plotH;
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(p.date).toFixed(1)},${y(p.value).toFixed(1)}`).join("");
  const last = points.at(-1)!;
  const shown = active !== null ? points[active] : null;

  function nearest(clientX: number) {
    const rect = box.current!.getBoundingClientRect();
    const px = clientX - rect.left;
    let best = 0;
    points.forEach((p, i) => {
      if (Math.abs(x(p.date) - px) < Math.abs(x(points[best].date) - px)) best = i;
    });
    return best;
  }

  return (
    <div>
      <div ref={box} className="relative select-none">
        <svg
          width={width} height={HEIGHT} role="img" aria-label={`${label}: ${points.length} ${noun}, latest ${format(last.value)}`}
          tabIndex={0} className="block touch-pan-y outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg"
          onPointerMove={(e) => setActive(nearest(e.clientX))}
          onPointerDown={(e) => setActive(nearest(e.clientX))}
          onPointerLeave={(e) => { if (e.pointerType === "mouse") setActive(null); }}
          onClick={() => { if (shown?.workoutId && onOpen) onOpen(shown.workoutId); }}
          onBlur={() => setActive(null)}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") setActive(Math.max(0, (active ?? points.length) - 1));
            else if (e.key === "ArrowRight") setActive(Math.min(points.length - 1, (active ?? -1) + 1));
            else if (e.key === "Enter" && shown?.workoutId && onOpen) onOpen(shown.workoutId);
            else return;
            e.preventDefault();
          }}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--color-stone-200)" strokeWidth={1} />
              <text x={PAD.left - 6} y={y(t)} dy="0.32em" textAnchor="end" className="fill-stone-500 text-[11px] tabular-nums">{t}</text>
            </g>
          ))}
          {xTicks(from, to, plotW).map((t) => (
            <text key={t.at} x={PAD.left + ((t.at - from) / (to - from)) * plotW} y={HEIGHT - 6} textAnchor="middle" className="fill-stone-500 text-[11px]">
              {t.label}
            </text>
          ))}
          <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {/* The latest value, labeled; a ring in the surface color sets the dot off the line. */}
          <circle cx={x(last.date)} cy={y(last.value)} r={4} fill={color} stroke="var(--color-white)" strokeWidth={2} />
          {shown && (
            <g pointerEvents="none">
              <line x1={x(shown.date)} x2={x(shown.date)} y1={PAD.top} y2={HEIGHT - PAD.bottom} stroke="var(--color-stone-400)" strokeWidth={1} />
              <circle cx={x(shown.date)} cy={y(shown.value)} r={5} fill={color} stroke="var(--color-white)" strokeWidth={2} />
            </g>
          )}
        </svg>
        {shown ? (
          <div className="pointer-events-none absolute top-0 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs shadow-sm"
            style={{ left: Math.min(Math.max(0, x(shown.date) - 70), width - 140), width: 140 }}>
            <div className="text-sm font-semibold tabular-nums">{format(shown.value)}</div>
            <div className="text-stone-500">{friendlyDate(shown.date)}{onOpen && shown.workoutId ? " · tap to open" : ""}</div>
          </div>
        ) : (
          <div className="pointer-events-none absolute text-xs font-semibold tabular-nums text-stone-700"
            style={{ right: Math.max(0, width - x(last.date) - 4), top: Math.max(0, y(last.value) - 22) }}>
            {format(last.value).split(" ")[0]}
          </div>
        )}
      </div>
      <details className="mt-1 text-sm">
        <summary className="cursor-pointer text-stone-500">Show as table</summary>
        <table className="mt-2 w-full text-left tabular-nums">
          <thead><tr className="text-xs text-stone-500"><th className="font-medium">Date</th><th className="font-medium">{label}</th></tr></thead>
          <tbody>
            {[...points].reverse().map((p) => (
              <tr key={p.date} className="border-t border-stone-100"><td className="py-1">{friendlyDate(p.date)}</td><td>{format(p.value)}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
