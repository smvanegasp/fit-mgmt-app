import type { DayPlan, Entry, SessionType, WeekPlan, Workout } from "../api";
import { dayType, heavyNext } from "./sets";

export const WARM_UP = "warm-up";

/**
 * The usual exercises of a day type in their usual order. On a Legs day the heavy lift goes first,
 * then the lighter one (they swap each time).
 */
export function usualFor(plan: string | undefined, types: SessionType[], workouts: Pick<Workout, "date" | "label" | "entries">[]): string[] {
  let usual = (types.find((t) => t.label === plan)?.exercises ?? []).filter((id) => id !== WARM_UP);
  const heavy = plan === "Legs" ? heavyNext(workouts) : null;
  if (heavy) {
    const light = heavy === "squat" ? "deadlift" : "squat";
    usual = [heavy, light, ...usual.filter((id) => id !== heavy && id !== light)];
  }
  return usual;
}

/**
 * What a workout starts with (Sergio, 2026-11-05): the warm-up, then the day's usual exercises,
 * filled in so there's nothing to pick. The ones not done are dropped when it's saved.
 */
export function startingEntries(plan: string | undefined, types: SessionType[], workouts: Pick<Workout, "date" | "label" | "entries">[], known: Set<string>, cardio?: string): Entry[] {
  // A Cardio day is one activity, picked at the start (Sergio, 2026-11-17: a ride, or a walk, not all).
  const day = plan === "Cardio" ? (cardio ? [cardio] : []) : usualFor(plan, types, workouts);
  const ids = [WARM_UP, ...day].filter((id) => known.has(id));
  return ids.map((exerciseId) => ({ exerciseId }));
}

/** The cardio choices for a Cardio day: its usual exercises that are cardio (ride, run, walk...). */
export function cardioOptions(types: SessionType[], cardioIds: Set<string>): string[] {
  const usual = types.find((t) => t.label === "Cardio")?.exercises ?? [];
  return usual.filter((id) => id !== WARM_UP && cardioIds.has(id));
}

/** The cardio done most recently (to preselect it), among the options. */
export function lastCardio(workouts: Pick<Workout, "date" | "entries">[], options: string[]): string | undefined {
  const newest = [...workouts].sort((a, b) => b.date.localeCompare(a.date));
  for (const w of newest) {
    const found = (w.entries ?? []).find((e) => options.includes(e.exerciseId));
    if (found) return found.exerciseId;
  }
  return options[0];
}

/** Anything recorded on an entry (matches the server's Entry.logged). */
export function isLogged(entry: Entry): boolean {
  return Boolean(
    entry.sets?.length || entry.problems?.length || entry.segments?.length || entry.notes?.length
    || entry.photos?.length || entry.minutes || entry.distanceMi || entry.peloton,
  );
}

/** The exercise being done now: the first one not marked done. */
export function currentIndex(entries: Entry[]): number {
  return entries.findIndex((e) => !e.done);
}

export interface DayOption {
  key: string;
  label: string;
  /** The workout's day type ("Push", "Upper"...). */
  dayType: string;
  /** The plan's exercises (none for a Cardio day that picks its activity at the start). */
  exercises?: string[];
  /** Already trained this week. */
  done: boolean;
  /** Doesn't count toward the week's goal. */
  optional?: boolean;
}

/**
 * A week type's days in its order, each marked done when a day of its kind was trained this week
 * (two Upper days need two Upper workouts), and the first not done as next up. `done` lists this
 * week's trained kinds, one per day (a lifting day with a ride after it gives its kind and Cardio).
 */
export function weekOptions(week: Pick<WeekPlan, "days">, done: string[]): { options: DayOption[]; next: string | null } {
  const left = new Map<string, number>();
  for (const kind of done) left.set(kind, (left.get(kind) ?? 0) + 1);
  const options = week.days.map((d) => {
    const n = left.get(d.kind) ?? 0;
    if (n > 0) left.set(d.kind, n - 1);
    return { key: d.id, label: d.name, dayType: d.kind, exercises: d.exercises.length ? d.exercises : undefined, done: n > 0, optional: d.optional };
  });
  // Next up: the first day that counts and isn't done, else an optional one.
  return { options, next: (options.find((o) => !o.done && !o.optional) ?? options.find((o) => !o.done))?.key ?? null };
}

/** The week type after this one in the rotation (they repeat in order). */
export function nextWeek<T extends { id: string }>(weeks: T[], id: string | null): T | undefined {
  const i = weeks.findIndex((w) => w.id === id);
  return weeks.length > 1 ? weeks[(i + 1) % weeks.length] : undefined;
}

/** A planned day's starting entries: the warm-up, then the plan's exercises (the ones that exist). */
export function planEntries(exercises: string[], known: Set<string>): Entry[] {
  return [WARM_UP, ...exercises.filter((id) => id !== WARM_UP)].filter((id) => known.has(id)).map((exerciseId) => ({ exerciseId }));
}

/**
 * The cycle of days (Sergio, 2026-11-23): the week types' days in rotation order, one loop. Where
 * Sergio is doesn't follow the calendar: the next day is the one after the last workout, so a short
 * week carries on into the next one instead of jumping to the other week type.
 */
export interface CycleDay {
  /** The day's id. */
  key: string;
  /** Its place in the cycle. */
  index: number;
  week: Pick<WeekPlan, "id" | "name">;
  day: DayPlan;
}

export function cycleDays(weeks: WeekPlan[]): CycleDay[] {
  return weeks.flatMap((w) => w.days.map((day) => ({ key: day.id, week: { id: w.id, name: w.name }, day }))).map((d, index) => ({ ...d, index }));
}

type CycleWorkout = Pick<Workout, "id" | "date" | "label" | "entries" | "planDays">;

/**
 * Replays the workouts (any order; sorted oldest first) along the cycle. A workout started from a
 * plan day is that day; an older one is matched by its day type, then by how many of the day's
 * exercises it has, then by being the nearest such day after the last one. A ride after lifting also
 * takes the Cardio day right after. Returns the place after the last match, and each workout's days.
 */
export function cyclePlace(cycle: CycleDay[], workouts: CycleWorkout[], cardioIds: Set<string>): {
  next: number; matched: Map<string, CycleDay[]>;
} {
  const matched = new Map<string, CycleDay[]>();
  let next = 0;
  const n = cycle.length;
  if (n === 0) return { next, matched };
  const byKey = new Map(cycle.map((d) => [d.key, d]));
  const ahead = (i: number) => (i - next + n) % n; // how far past the current place
  for (const w of [...workouts].sort((a, b) => a.date.localeCompare(b.date))) {
    let days = (w.planDays ?? []).map((k) => byKey.get(k)).filter((d): d is CycleDay => d !== undefined);
    if (days.length === 0) {
      const kind = dayType(w.label || "");
      const ids = new Set((w.entries ?? []).map((e) => e.exerciseId));
      const overlap = (d: CycleDay) => d.day.exercises.filter((x) => ids.has(x)).length;
      const best = cycle.filter((d) => d.day.kind === kind)
        .sort((a, b) => overlap(b) - overlap(a) || ahead(a.index) - ahead(b.index))[0];
      if (!best) continue;
      days = [best];
      const after = cycle[(best.index + 1) % n];
      if (kind !== "Cardio" && after.day.kind === "Cardio" && [...ids].some((x) => cardioIds.has(x))) days.push(after);
    }
    matched.set(w.id, days);
    next = (days.at(-1)!.index + 1) % n;
  }
  return { next, matched };
}

/**
 * What Train shows (Sergio, 2026-11-23: "the next 4 trainings and the last two, always"): the last
 * two workouts with the plan days they were, and the next four days of the cycle from where Sergio is.
 */
export function cycleView<W extends CycleWorkout>(weeks: WeekPlan[], workouts: W[], cardioIds: Set<string>, count = 4): {
  last: { workout: W; days: CycleDay[] }[]; next: CycleDay[]; cycle: CycleDay[];
} {
  const cycle = cycleDays(weeks);
  const { next, matched } = cyclePlace(cycle, workouts, cardioIds);
  const newest = [...workouts].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 2).reverse();
  return {
    last: newest.map((workout) => ({ workout, days: matched.get(workout.id) ?? [] })),
    next: Array.from({ length: Math.min(count, cycle.length) }, (_, i) => cycle[(next + i) % cycle.length]),
    cycle,
  };
}
