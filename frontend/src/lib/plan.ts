import type { Entry, SessionType, WeekPlan, Workout } from "../api";
import { heavyNext } from "./sets";

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
