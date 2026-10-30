import type { Step } from "../api";
import { weekStart } from "./weeks";

export const DAY_TYPES = ["Push", "Legs", "Pull", "Cardio"] as const;
export type DayType = (typeof DAY_TYPES)[number];

/** Workouts a week needs to keep the streak going. */
export const WEEKLY_GOAL = 3;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parse(day: string): Date {
  return new Date(`${day}T12:00:00`);
}

function iso(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function addDays(day: string, n: number): string {
  const date = parse(day);
  date.setDate(date.getDate() + n);
  return iso(date);
}

/** "Oct 26" (and the year when it isn't this year's). */
export function shortDate(day: string, today?: string): string {
  const date = parse(day);
  const year = today && day.slice(0, 4) !== today.slice(0, 4) ? `, ${date.getFullYear()}` : "";
  return `${MONTHS[date.getMonth()]} ${date.getDate()}${year}`;
}

/** Weeks newest first, `count` of them ending with this one: Monday and the 7 days. */
export function weekRows(today: string, count: number): { monday: string; days: string[] }[] {
  const rows = [];
  for (let i = 0, monday = weekStart(today); i < count; i++, monday = addDays(monday, -7)) {
    rows.push({ monday, days: Array.from({ length: 7 }, (_, d) => addDays(monday, d)) });
  }
  return rows;
}

/** Workouts per week (Monday -> count). */
export function weekCounts(days: { date: string }[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const d of days) counts.set(weekStart(d.date), (counts.get(weekStart(d.date)) ?? 0) + 1);
  return counts;
}

/** Weeks in a row with at least `goal` workouts. This week only adds once it reaches the goal,
 * and doesn't break the streak while it's still going. */
export function streaks(days: { date: string }[], today: string, goal = WEEKLY_GOAL): { current: number; longest: number } {
  if (days.length === 0) return { current: 0, longest: 0 };
  const counts = weekCounts(days);
  const first = weekStart(days.reduce((min, d) => (d.date < min ? d.date : min), days[0].date));
  const thisWeek = weekStart(today);
  let run = 0;
  let longest = 0;
  for (let monday = first; monday <= thisWeek; monday = addDays(monday, 7)) {
    if ((counts.get(monday) ?? 0) >= goal) run += 1;
    else if (monday !== thisWeek) run = 0;
    longest = Math.max(longest, run);
  }
  return { current: run, longest };
}

/** "Sep 1 – 8", "Sep 29 – Oct 6", or one day. */
export function stepDates(step: Step, today: string): string {
  const first = step.sessions[0].date;
  const last = step.sessions.at(-1)!.date;
  if (first === last) return shortDate(first, today);
  const end = first.slice(0, 7) === last.slice(0, 7) ? String(Number(last.slice(8))) : shortDate(last);
  return `${shortDate(first, today)} – ${end}`;
}
