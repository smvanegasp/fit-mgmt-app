import { GOAL, GOAL_FROM, OLD_GOAL, addDays, streaks, weekCounts, type Goals, type PlanGoal } from "./progress";
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
export function weekRemaining(days: Day[], today: string, goal?: PlanGoal): {
  met: boolean; strength: number; cardio: number; daysLeft: number; text: string;
} {
  const monday = weekStart(today);
  const c = weekCounts(days).get(monday);
  const index = Math.round((Date.parse(`${today}T12:00:00`) - Date.parse(`${monday}T12:00:00`)) / 86_400_000);
  const daysLeft = Math.max(0, 6 - index);
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

  if (!goal && monday < GOAL_FROM) {
    const need = Math.max(0, OLD_GOAL - (c?.workouts ?? 0));
    return { met: need === 0, strength: 0, cardio: 0, daysLeft, text: need === 0 ? "Week's goal reached" : plural(need, "workout") };
  }
  const g = goal ?? GOAL;
  const strength = Math.max(0, g.strength - (c?.strength ?? 0));
  const cardio = Math.max(0, g.cardio - (c?.cardio ?? 0));
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
export function streakAtRisk(days: Day[], today: string, goal?: PlanGoal): boolean {
  const r = weekRemaining(days, today, goal);
  return !r.met && r.daysLeft <= 2;
}

const ROTATION = ["Push", "Legs", "Pull"] as const;

export interface WeekSlot {
  /** "Push", "Legs", "Pull" or "Cardio": the day done, or the one still to do. */
  type: string;
  /** The planned day's name ("Heavy push"), when the plans set the week's goal. */
  name?: string;
  done: boolean;
}

/**
 * This week (Monday to Sunday) as the goal's slots (Sergio, 2026-11-19: the old "2 strength days"
 * text read as days done, not days left): three strength slots and one cardio slot. Done days
 * fill them in the order they were trained; the empty ones show the rotation's days not done yet.
 */
export function weekSlots(days: Day[], today: string, goal?: PlanGoal): WeekSlot[] {
  const monday = weekStart(today);
  const sunday = addDays(monday, 6);
  const week = days.filter((d) => d.date >= monday && d.date <= sunday).sort((a, b) => a.date.localeCompare(b.date));
  if (goal?.days) return planSlots(week, goal.days);
  const strength = week.filter((d) => d.type && (ROTATION as readonly string[]).includes(d.type)).map((d) => d.type!);
  const missing = ROTATION.filter((t) => !strength.includes(t));
  const slots: WeekSlot[] = strength.slice(0, GOAL.strength).map((type) => ({ type, done: true }));
  for (const type of missing) if (slots.length < GOAL.strength) slots.push({ type, done: false });
  while (slots.length < GOAL.strength) slots.push({ type: "Push", done: false });
  const cardio = week.filter((d) => d.cardio || d.type === "Cardio").length;
  for (let i = 0; i < GOAL.cardio; i++) slots.push({ type: "Cardio", done: i < cardio });
  return slots;
}

/**
 * This week's slots from its plan (Sergio, 2026-11-23: the goal follows the plan): one per day that
 * counts, named by the day. A trained day fills the slot of its own kind first; any other strength
 * day fills a strength slot still open (the goal counts strength days of any kind), cardio a cardio one.
 */
function planSlots(week: Day[], planned: { name: string; kind: string }[]): WeekSlot[] {
  const slots: WeekSlot[] = planned.map((d) => ({ type: d.kind, name: d.name, done: false }));
  const leftover: Day[] = [];
  const trained = week.flatMap((d) => [{ ...d, type: d.type }, ...(d.cardio && d.type !== "Cardio" ? [{ ...d, type: "Cardio" }] : [])]);
  for (const d of trained) {
    const slot = slots.find((s) => !s.done && s.type === d.type);
    if (slot) slot.done = true;
    else leftover.push(d);
  }
  for (const d of leftover) {
    const cardio = d.type === "Cardio";
    const slot = slots.find((s) => !s.done && (s.type === "Cardio") === cardio);
    if (slot) slot.done = true;
  }
  return slots;
}

/** The streak, the band, shields and this week's slots in one call, for the Train screen. */
export function streakStatus(days: Day[], today: string, goals?: Goals) {
  const goal = goals?.get(weekStart(today));
  const run = streaks(days, today, goals);
  const week = weekRemaining(days, today, goal);
  // The week that just reached a milestone shows that band full until the week ends, instead of
  // the next band empty (Sergio, 2026-11-22: an empty ladder on a good day read as a broken streak).
  const onMilestone = week.met && run.current > 0 && milestoneAt(run.current) === run.current;
  return {
    ...run,
    band: milestoneBand(run.current),
    onMilestone,
    week,
    slots: weekSlots(days, today, goal),
    atRisk: streakAtRisk(days, today, goal),
    /** This week's week type, when the plans set its goal. */
    weekName: goal?.week,
  };
}

/** What changed between two looks at the streak, for the congrats: a milestone passed, a shield earned. */
export function streakNews(before: { current: number; shields: number }, after: { current: number; shields: number }): {
  milestone: number | null; shield: boolean;
} {
  return {
    milestone: milestoneCrossed(before.current, after.current),
    shield: after.current > before.current && after.shields > before.shields,
  };
}
