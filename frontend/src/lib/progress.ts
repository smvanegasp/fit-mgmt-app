import { weekStart } from "./weeks";

export const DAY_TYPES = ["Push", "Legs", "Pull", "Cardio"] as const;
export type DayType = (typeof DAY_TYPES)[number];

/** Workouts a week needs to keep the streak going. */
export const WEEKLY_GOAL = 3;

export const RANGES = ["3M", "6M", "1Y", "All"] as const;
export type Range = (typeof RANGES)[number];

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

/** The first day a range shows: "6M" is the 1st of the month 5 months back, so the calendar
 * shows 6 whole months; "All" starts at the first workout. */
export function rangeStart(range: Range, today: string, first: string): string {
  if (range === "All") return first < today ? first : today;
  const months = { "3M": 3, "6M": 6, "1Y": 12 }[range];
  const date = parse(today);
  date.setDate(1);
  date.setMonth(date.getMonth() - (months - 1));
  return iso(date);
}

/** "Oct 26" */
export function shortDate(day: string): string {
  const date = parse(day);
  return `${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

/** Days since 1970 at local noon, for chart x positions. */
export function dayNumber(day: string): number {
  return Math.round(parse(day).getTime() / 86_400_000);
}

export function fromDayNumber(n: number): string {
  return iso(new Date(n * 86_400_000));
}

export interface Week {
  monday: string;
  counts: Record<DayType, number>;
  total: number;
}

/** Every week from the one holding `from` to this one (empty weeks included), oldest first. */
export function weeklyCounts(days: { date: string; type: string }[], from: string, today: string): Week[] {
  const weeks: Week[] = [];
  const byMonday = new Map<string, Week>();
  for (let monday = weekStart(from); monday <= today; monday = addDays(monday, 7)) {
    const week = { monday, counts: { Push: 0, Legs: 0, Pull: 0, Cardio: 0 }, total: 0 };
    weeks.push(week);
    byMonday.set(monday, week);
  }
  for (const d of days) {
    const week = byMonday.get(weekStart(d.date));
    if (!week) continue;
    const type = (DAY_TYPES as readonly string[]).includes(d.type) ? (d.type as DayType) : "Push";
    week.counts[type] += 1;
    week.total += 1;
  }
  return weeks;
}

/** Weeks in a row with at least `goal` workouts. This week only adds once it reaches the goal,
 * and doesn't break the streak while it's still going. */
export function streaks(days: { date: string }[], today: string, goal = WEEKLY_GOAL): { current: number; longest: number } {
  if (days.length === 0) return { current: 0, longest: 0 };
  const first = days.reduce((min, d) => (d.date < min ? d.date : min), days[0].date);
  const weeks = weeklyCounts(days.map((d) => ({ ...d, type: "Push" })), first, today);
  const thisWeek = weekStart(today);
  let run = 0;
  let longest = 0;
  for (const week of weeks) {
    if (week.total >= goal) run += 1;
    else if (week.monday !== thisWeek) run = 0;
    longest = Math.max(longest, run);
  }
  return { current: run, longest };
}

export interface Month {
  /** "2026-10" */
  key: string;
  /** "Oct" or "Oct 2025" when not this year. */
  label: string;
  /** Rows Monday to Sunday; null pads days outside the month. */
  weeks: (string | null)[][];
}

/** Calendar months from the one holding `from` to this one, newest first. */
export function calendarMonths(from: string, today: string): Month[] {
  const months: Month[] = [];
  const cursor = parse(from);
  cursor.setDate(1);
  const end = parse(today);
  while (cursor.getFullYear() < end.getFullYear() || (cursor.getFullYear() === end.getFullYear() && cursor.getMonth() <= end.getMonth())) {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const weeks: (string | null)[][] = [];
    let row: (string | null)[] = Array((cursor.getDay() + 6) % 7).fill(null);
    for (const day = new Date(cursor); day.getMonth() === month; day.setDate(day.getDate() + 1)) {
      row.push(iso(day));
      if (row.length === 7) {
        weeks.push(row);
        row = [];
      }
    }
    if (row.length) weeks.push([...row, ...Array(7 - row.length).fill(null)]);
    months.push({
      key: `${year}-${String(month + 1).padStart(2, "0")}`,
      label: year === end.getFullYear() ? MONTHS[month] : `${MONTHS[month]} ${year}`,
      weeks,
    });
    cursor.setMonth(month + 1);
  }
  return months.reverse();
}

/** "185 lb", "+90 lb" (added weight), "12 reps", "45 s". */
export function valueText(value: number, unit: "lb" | "reps" | "s", added = false): string {
  if (unit === "lb") return `${added ? "+" : ""}${value} lb`;
  return unit === "s" ? `${value} s` : `${value} reps`;
}

/** Round axis ticks covering [min, max]: niceTicks(150, 230) -> [140, 160, 180, 200, 220, 240]. */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const raw = (max - min) / count;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= raw) ?? 10 * power;
  const ticks: number[] = [];
  for (let t = Math.floor(min / step) * step; t < max + step; t += step) {
    ticks.push(Math.round(t * 100) / 100);
    if (t >= max) break;
  }
  return ticks;
}

/** First-of-month days between two days for the x axis, thinned to at most `max` labels
 * ("Jun", or the year for January). */
export function monthTicks(from: string, to: string, max = 6): { day: string; label: string }[] {
  const all: { day: string; label: string }[] = [];
  const cursor = parse(from);
  cursor.setDate(1);
  if (iso(cursor) < from) cursor.setMonth(cursor.getMonth() + 1);
  while (iso(cursor) <= to) {
    all.push({ day: iso(cursor), label: cursor.getMonth() === 0 ? String(cursor.getFullYear()) : MONTHS[cursor.getMonth()] });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  const every = Math.ceil(all.length / max);
  return all.filter((_, i) => (all.length - 1 - i) % every === 0);
}
