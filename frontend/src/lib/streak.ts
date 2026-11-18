import { GOAL, GOAL_FROM, OLD_GOAL, streaks, weekCounts } from "./progress";
import { weekStart } from "./weeks";

type Day = { date: string; type?: string; cardio?: boolean };

/**
 * Streak milestones: weeks in a row that reached the weekly goal. Each one is a step worth a
 * congrats of its own — the same hit the target celebration gives, but for showing up.
 */
export const MILESTONES = [4, 8, 12, 16, 24, 36, 52] as const;

/** The highest milestone the streak has reached (0 before the first). */
export function milestoneAt(weeks: number): number {
  let hit = 0;
  for (const m of MILESTONES) if (weeks >= m) hit = m;
  return hit;
}

/** The next milestone above the streak. Past a year, a fresh one every 52 weeks. */
export function nextMilestone(weeks: number): number {
  for (const m of MILESTONES) if (m > weeks) return m;
  return Math.ceil((weeks + 1) / 52) * 52;
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
  if (to <= from) return null;
  const next = nextMilestone(from);
  return next <= to ? next : null;
}

/** What this week still needs to keep the streak, and how many days are left to get it.
 * Sunday is the last day: `daysLeft` counts the days after today. */
export function weekRemaining(days: Day[], today: string): {
  met: boolean; strength: number; cardio: number; daysLeft: number; text: string;
} {
  const monday = weekStart(today);
  const c = weekCounts(days).get(monday);
  const index = Math.round((Date.parse(`${today}T12:00:00`) - Date.parse(`${monday}T12:00:00`)) / 86_400_000);
  const daysLeft = Math.max(0, 6 - index);
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

  if (monday < GOAL_FROM) {
    const need = Math.max(0, OLD_GOAL - (c?.workouts ?? 0));
    return { met: need === 0, strength: 0, cardio: 0, daysLeft, text: need === 0 ? "Week's goal reached" : plural(need, "workout") };
  }
  const strength = Math.max(0, GOAL.strength - (c?.strength ?? 0));
  const cardio = Math.max(0, GOAL.cardio - (c?.cardio ?? 0));
  const parts = [strength ? plural(strength, "strength day") : "", cardio ? plural(cardio, "cardio day") : ""].filter(Boolean);
  return {
    met: parts.length === 0,
    strength,
    cardio,
    daysLeft,
    text: parts.length === 0 ? "Week's goal reached" : parts.join(" and "),
  };
}

/** "3 days left", "1 day left", "today is the last day". */
export function daysLeftText(daysLeft: number): string {
  if (daysLeft === 0) return "today is the last day";
  return `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`;
}

/** Whether the streak is in real danger: this week's goal isn't met and there's little left to fix it. */
export function streakAtRisk(days: Day[], today: string): boolean {
  const r = weekRemaining(days, today);
  return !r.met && r.daysLeft <= 2;
}

/** The streak, the band and this week's remaining work in one call, for the Train screen. */
export function streakStatus(days: Day[], today: string) {
  const { current, longest } = streaks(days, today);
  return { current, longest, band: milestoneBand(current), week: weekRemaining(days, today), atRisk: streakAtRisk(days, today) };
}
