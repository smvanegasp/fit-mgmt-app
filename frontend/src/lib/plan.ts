import type { Entry, SessionType, Workout } from "../api";
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
