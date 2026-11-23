import { GROW_DAYS, KEEP_DAYS, addDays, streaks, weekState, type WeekState } from "./progress";
import { STREAK_TIERS, WORKOUT_TIERS, nextTier, tierAt, tierCrossed, type Tier } from "./tiers";
import { weekStart } from "./weeks";

type Day = { date: string; type?: string; cardio?: boolean };

/**
 * Streak milestones are the streak tiers (lib/tiers.ts): each one gets a congrats of its own, the
 * same hit the target celebration gives, but for showing up.
 */
export function milestoneAt(weeks: number): number {
  return tierAt(STREAK_TIERS, weeks)?.at ?? 0;
}

/** The next milestone above the streak. */
export function nextMilestone(weeks: number): number {
  return nextTier(STREAK_TIERS, weeks).at;
}

/** The band being climbed right now: weeks banked since the last milestone, the band's width,
 * and the milestone ahead. Standing on a milestone, the band is the one after it. */
export function milestoneBand(weeks: number): { filled: number; total: number; to: number } {
  const from = milestoneAt(weeks);
  const to = nextMilestone(weeks);
  return { filled: weeks - from, total: to - from, to };
}

/** The milestone the streak passed on its way from `from` to `to` weeks, or null. */
export function milestoneCrossed(from: number, to: number): number | null {
  return tierCrossed(STREAK_TIERS, from, to)?.at ?? null;
}

export interface WeekProgress {
  /** Days trained this week so far. */
  days: number;
  state: WeekState;
  /** Days left after today (Sunday is the last). */
  daysLeft: number;
}

/** This week so far: days trained, where that leaves the streak, and the days left. */
export function weekProgress(days: Day[], today: string): WeekProgress {
  const monday = weekStart(today);
  const sunday = addDays(monday, 6);
  const n = new Set(days.filter((d) => d.date >= monday && d.date <= sunday).map((d) => d.date)).size;
  const index = Math.round((Date.parse(`${today}T12:00:00`) - Date.parse(`${monday}T12:00:00`)) / 86_400_000);
  return { days: n, state: weekState(n), daysLeft: Math.max(0, 6 - index) };
}

/** "3 days left", "1 day left", "today is the last day". */
export function daysLeftText(daysLeft: number): string {
  if (daysLeft === 0) return "today is the last day";
  return `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`;
}

/** What the week needs next: "2 more days keep it", "1 more day grows it", "Grew the streak". */
export function weekNeedText(w: WeekProgress): string {
  if (w.state === "grow") return "Grew the streak";
  const plural = (n: number) => `${n} more day${n === 1 ? "" : "s"}`;
  if (w.state === "miss") return `${plural(KEEP_DAYS - w.days)} keep${KEEP_DAYS - w.days === 1 ? "s" : ""} it`;
  return `${plural(GROW_DAYS - w.days)} grow${GROW_DAYS - w.days === 1 ? "s" : ""} it`;
}

/** Whether the streak is in real danger: not even 2 days in yet, and little week left. */
export function streakAtRisk(days: Day[], today: string): boolean {
  const w = weekProgress(days, today);
  return w.state === "miss" && w.daysLeft <= 2;
}

export interface WeekSlot {
  /** The day type trained ("Push"), or empty for a day still to train. */
  type: string;
  done: boolean;
}

/**
 * This week (Monday to Sunday) as four slots, one per training day toward growing the streak,
 * filled in the order the days were trained, in their day type's color. The second keeps the
 * streak, the fourth grows it. Days past four are counted in `extra`.
 */
export function weekSlots(days: Day[], today: string): { slots: WeekSlot[]; extra: number } {
  const monday = weekStart(today);
  const sunday = addDays(monday, 6);
  const byDate = new Map(days.filter((d) => d.date >= monday && d.date <= sunday).map((d) => [d.date, d]));
  const week = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  const slots: WeekSlot[] = Array.from({ length: GROW_DAYS }, (_, i) =>
    week[i] ? { type: week[i].type ?? "", done: true } : { type: "", done: false });
  return { slots, extra: Math.max(0, week.length - GROW_DAYS) };
}

/** The streak, its band and tier, shields and this week in one call, for the Train screen. */
export function streakStatus(days: Day[], today: string) {
  const run = streaks(days, today);
  const week = weekProgress(days, today);
  // The week that just reached a milestone shows that band full until the week ends, instead of
  // the next band empty (Sergio, 2026-11-22: an empty ladder on a good day read as a broken streak).
  const onMilestone = week.state === "grow" && run.current > 0 && milestoneAt(run.current) === run.current;
  return {
    ...run,
    band: milestoneBand(run.current),
    onMilestone,
    week,
    ...weekSlots(days, today),
    atRisk: run.current > 0 && streakAtRisk(days, today),
    tier: tierAt(STREAK_TIERS, run.current),
    best: tierAt(STREAK_TIERS, run.longest),
    next: nextTier(STREAK_TIERS, run.current),
  };
}

/** What changed between two looks, for the congrats: a streak tier passed, a shield earned, a
 * workout tier reached (the count is the days trained, one workout per day). */
export function streakNews(
  before: { current: number; shields: number; workouts?: number },
  after: { current: number; shields: number; workouts?: number },
): { milestone: number | null; shield: boolean; workouts: Tier | null } {
  return {
    milestone: milestoneCrossed(before.current, after.current),
    shield: after.current > before.current && after.shields > before.shields,
    workouts: before.workouts !== undefined && after.workouts !== undefined
      ? tierCrossed(WORKOUT_TIERS, before.workouts, after.workouts) : null,
  };
}
