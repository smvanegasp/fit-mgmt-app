import type { Step } from "../api";
import { weekStart } from "./weeks";

export const DAY_TYPES = ["Push", "Legs", "Pull", "Cardio"] as const;
export type DayType = (typeof DAY_TYPES)[number];
/** Mixed day kinds a plan can have (Sergio, 2026-11-23); they count as strength days. */
export const MIXED = ["Upper", "Lower", "Full body"] as const;
/** Every kind of day, in the order the plan editor offers them. */
export const KINDS = ["Push", "Legs", "Pull", ...MIXED, "Cardio"] as const;

/**
 * The streak's weekly rule (Sergio, 2026-11-23, applied to the whole history): 4 training days in a
 * week (Monday to Sunday, any kind) grow the streak; 2 or 3 hold it (no loss, no gain); 0 or 1 miss,
 * which a shield covers or the streak ends. A day is a day trained: a ride after lifting is one.
 */
export const GROW_DAYS = 4;
export const KEEP_DAYS = 2;
const STRENGTH = new Set<string>(["Push", "Legs", "Pull", ...MIXED]);

export type WeekState = "grow" | "hold" | "miss";

export function weekState(days: number): WeekState {
  return days >= GROW_DAYS ? "grow" : days >= KEEP_DAYS ? "hold" : "miss";
}

/** "4 days: grew", "3 days: held", "1 day: missed". */
export function weekText(days: number): string {
  const word = { grow: "grew", hold: "held", miss: "missed" }[weekState(days)];
  return `${days} day${days === 1 ? "" : "s"}: ${word}`;
}

/** One week's training: days of any kind, strength days, cardio days. */
export interface WeekCount {
  workouts: number;
  strength: number;
  cardio: number;
}

type Day = { date: string; type?: string; cardio?: boolean };

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

/** Each week's training (Monday -> counts). */
export function weekCounts(days: Day[]): Map<string, WeekCount> {
  const counts = new Map<string, WeekCount>();
  for (const d of days) {
    const monday = weekStart(d.date);
    const c = counts.get(monday) ?? { workouts: 0, strength: 0, cardio: 0 };
    c.workouts += 1;
    if (d.type && STRENGTH.has(d.type)) c.strength += 1;
    if (d.cardio || d.type === "Cardio") c.cardio += 1;
    counts.set(monday, c);
  }
  return counts;
}

/**
 * Shields (Sergio, 2026-11-20; every 8 weeks from 11-23, was 10): every SHIELD_EVERY weeks that grow
 * the streak earn one, and a shield covers one missed week (used up when the week ends). Held weeks
 * neither add nor earn; a missed week with no shield left ends the run and its shields.
 */
export const SHIELD_EVERY = 8;

export interface StreakRun {
  /** Weeks that grew the streak, in a row (held and shielded weeks keep it alive). */
  current: number;
  longest: number;
  /** Shields in hand. */
  shields: number;
  /** Growing weeks still needed to earn the next shield. */
  toShield: number;
  /** The Mondays of weeks a shield covered, in the current run and before. */
  shielded: string[];
}

/** The streak replayed over the whole history. This week grows it once it reaches 4 days, and
 * doesn't break it (or use a shield) while it's still going. */
export function streaks(days: Day[], today: string): StreakRun {
  if (days.length === 0) return { current: 0, longest: 0, shields: 0, toShield: SHIELD_EVERY, shielded: [] };
  const counts = weekCounts(days);
  const first = weekStart(days.reduce((min, d) => (d.date < min ? d.date : min), days[0].date));
  const thisWeek = weekStart(today);
  let run = 0;
  let longest = 0;
  let shields = 0;
  let earning = 0; // growing weeks banked toward the next shield
  const shielded: string[] = [];
  for (let monday = first; monday <= thisWeek; monday = addDays(monday, 7)) {
    const state = weekState(counts.get(monday)?.workouts ?? 0);
    if (state === "grow") {
      run += 1;
      earning += 1;
      if (earning === SHIELD_EVERY) {
        shields += 1;
        earning = 0;
      }
    } else if (state === "miss" && monday !== thisWeek) {
      if (run > 0 && shields > 0) {
        shields -= 1;
        shielded.push(monday);
      } else {
        run = 0;
        shields = 0;
        earning = 0;
      }
    }
    longest = Math.max(longest, run);
  }
  return { current: run, longest, shields, toShield: SHIELD_EVERY - earning, shielded };
}

/** "Sep 1 – 8", "Sep 29 – Oct 6", or one day. */
export function stepDates(step: Step, today: string): string {
  const first = step.sessions[0].date;
  const last = step.sessions.at(-1)!.date;
  if (first === last) return shortDate(first, today);
  const end = first.slice(0, 7) === last.slice(0, 7) ? String(Number(last.slice(8))) : shortDate(last);
  return `${shortDate(first, today)} – ${end}`;
}
