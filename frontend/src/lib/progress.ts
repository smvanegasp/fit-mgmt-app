import type { Step } from "../api";
import { weekStart } from "./weeks";

export const DAY_TYPES = ["Push", "Legs", "Pull", "Cardio"] as const;
export type DayType = (typeof DAY_TYPES)[number];
/** Mixed day kinds a plan can have (Sergio, 2026-11-23); they count as strength days. */
export const MIXED = ["Upper", "Lower", "Full body"] as const;
/** Every kind of day, in the order the plan editor offers them. */
export const KINDS = ["Push", "Legs", "Pull", ...MIXED, "Cardio"] as const;

/**
 * The weekly goal (Sergio, 2026-11-17): 3 strength days (Push, Legs, Pull) and 1 cardio day (a
 * ride, run or walk, alone or after lifting). It applies from the week of Sergio's first Peloton
 * ride; weeks before it keep the old goal of 3 workouts of any kind, so the history and the streak
 * stay as they were.
 */
export const GOAL = { strength: 3, cardio: 1 } as const;
export const OLD_GOAL = 3;
export const GOAL_FROM = "2026-10-26";
const STRENGTH = new Set<string>(["Push", "Legs", "Pull", ...MIXED]);

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

/** A week's goal from the plans (from the first saved plan on); other weeks use the fixed goal. */
export interface PlanGoal {
  strength: number;
  cardio: number;
  week?: string;
  days?: { name: string; kind: string }[];
}

/** Monday -> that week's goal from the plans. */
export type Goals = Map<string, PlanGoal>;

export function goalsByWeek(goals: ({ monday: string } & PlanGoal)[] | undefined): Goals {
  return new Map((goals ?? []).map((g) => [g.monday, g]));
}

/** Whether a week reached its goal: its plan's (Sergio, 2026-11-23: the goal follows the plan; a
 * planned week of only optional days is a rest week, met as it is), else the fixed one, or the old
 * one before GOAL_FROM. */
export function weekMet(monday: string, c: WeekCount | undefined, goal?: PlanGoal): boolean {
  if (goal) return (c?.strength ?? 0) >= goal.strength && (c?.cardio ?? 0) >= goal.cardio;
  if (!c) return false;
  return monday < GOAL_FROM ? c.workouts >= OLD_GOAL : c.strength >= GOAL.strength && c.cardio >= GOAL.cardio;
}

/** "2 of 3 strength · 0 of 1 cardio" (or "2 of 3 workouts" for a week before GOAL_FROM). */
export function goalText(monday: string, c: WeekCount | undefined, goal?: PlanGoal): string {
  if (!goal && monday < GOAL_FROM) return `${c?.workouts ?? 0} of ${OLD_GOAL} workouts`;
  const g = goal ?? GOAL;
  return `${c?.strength ?? 0} of ${g.strength} strength · ${c?.cardio ?? 0} of ${g.cardio} cardio`;
}

/**
 * Shields (Sergio, 2026-11-20; every 8 weeks from 11-23, was 10): every SHIELD_EVERY weeks of the run earn one, and a shield covers
 * one missed week (used up automatically when the week ends). A covered week keeps the streak
 * alive without adding to it; a missed week with no shield left ends the run and its shields.
 */
export const SHIELD_EVERY = 8;

export interface StreakRun {
  /** Weeks in a row that reached the goal (shielded weeks keep it alive but don't add). */
  current: number;
  longest: number;
  /** Shields in hand. */
  shields: number;
  /** Weeks of the run still needed to earn the next shield. */
  toShield: number;
  /** The Mondays of weeks a shield covered, in the current run and before. */
  shielded: string[];
}

/** Weeks in a row that reached the goal, with shields. This week only adds once it reaches the
 * goal, and doesn't break the streak (or use a shield) while it's still going. */
export function streaks(days: Day[], today: string, goals?: Goals): StreakRun {
  if (days.length === 0) return { current: 0, longest: 0, shields: 0, toShield: SHIELD_EVERY, shielded: [] };
  const counts = weekCounts(days);
  const first = weekStart(days.reduce((min, d) => (d.date < min ? d.date : min), days[0].date));
  const thisWeek = weekStart(today);
  let run = 0;
  let longest = 0;
  let shields = 0;
  let earning = 0; // weeks banked toward the next shield
  const shielded: string[] = [];
  for (let monday = first; monday <= thisWeek; monday = addDays(monday, 7)) {
    if (weekMet(monday, counts.get(monday), goals?.get(monday))) {
      run += 1;
      earning += 1;
      if (earning === SHIELD_EVERY) {
        shields += 1;
        earning = 0;
      }
    } else if (monday !== thisWeek) {
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
