import { useLayoutEffect, useMemo, useRef, useState } from "react";

import { WEEKLY_GOAL, shortDate, weekCounts, weekRows } from "../lib/progress";
import { longDate } from "../lib/weeks";
import { typeColor } from "./Progression";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

/** Training days as a heatmap: weeks as columns (as many recent ones as fit, up to a year), Monday on
 * top, each day in its day type's color, and a blue mark under weeks that reached the goal. Shared by
 * the desktop Progress dashboard and the welcome page. Days with a workoutId open it when tapped. */
export function Heatmap({ days, today, onOpen }: {
  days: { date: string; type: string; workoutId?: string; label?: string }[];
  today: string;
  onOpen?: (workoutId: string) => void;
}) {
  const byDate = useMemo(() => new Map(days.map((d) => [d.date, d])), [days]);
  const counts = useMemo(() => weekCounts(days), [days]);
  const grid = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(52);
  useLayoutEffect(() => {
    const el = grid.current;
    if (!el) return;
    const measure = () => setFit(Math.max(8, Math.min(52, Math.floor((el.clientWidth - 24) / 17))));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const weeks = weekRows(today, fit).reverse();
  const first = days[0]?.date ?? today;

  return (
    <div ref={grid} className="flex gap-[3px]">
      <div className="mr-1 flex flex-col gap-[3px] pt-5 text-[10px] text-stone-500">
        {WEEKDAYS.map((d, i) => <span key={i} className="h-3.5 leading-[14px]">{i % 2 === 0 ? d : ""}</span>)}
      </div>
      {weeks.map((week, w) => {
        const month = w === 0 || week.monday.slice(0, 7) !== weeks[w - 1].monday.slice(0, 7);
        const n = counts.get(week.monday) ?? 0;
        return (
          <div key={week.monday} className="flex min-w-3.5 flex-1 flex-col gap-[3px]">
            <span className="h-4 text-[10px] whitespace-nowrap text-stone-500">{month ? shortDate(week.monday).split(" ")[0] : ""}</span>
            {week.days.map((day) => {
              const workout = byDate.get(day);
              const ring = day === today ? "ring-2 ring-stone-400" : "";
              if (workout && onOpen && workout.workoutId) {
                const name = `${longDate(day, today)}: ${workout.label || workout.type}`;
                return (
                  <button key={day} type="button" onClick={() => onOpen(workout.workoutId!)} title={name} aria-label={name}
                    className={`h-3.5 rounded-[3px] hover:opacity-80 ${ring}`} style={{ background: typeColor(workout.type) }} />
                );
              }
              if (workout) {
                return <span key={day} title={`${longDate(day, today)}: ${workout.type}`} className={`h-3.5 rounded-[3px] ${ring}`}
                  style={{ background: typeColor(workout.type) }} />;
              }
              return <span key={day} className={`h-3.5 rounded-[3px] ${day > today || day < first ? "" : "bg-stone-100"}`} />;
            })}
            {/* The week reached the goal. */}
            <span className={`mt-1 h-1 rounded-full ${n >= WEEKLY_GOAL ? "bg-blue-600" : ""}`} title={`${n} workouts`} />
          </div>
        );
      })}
    </div>
  );
}
