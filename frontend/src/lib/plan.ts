import type { DayPlan, Entry, SessionType, Workout } from "../api";
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

/**
 * "Squat & heavy push week" / "Deadlift & heavy pull week" (Sergio, 2026-11-23): the week's Legs
 * lift and its heavy day. "Week A" when the plans can't tell the two weeks apart.
 */
export function weekName(plans: Pick<DayPlan, "week" | "dayType" | "name">[], week: "A" | "B"): string {
  const name = (w: "A" | "B") => {
    const legs = plans.find((p) => p.week === w && p.dayType === "Legs");
    const lift = legs?.name.replace(/^Legs\s*·\s*/, "");
    const heavy = plans.find((p) => p.week === w && /^heavy /i.test(p.name));
    const parts = [lift && lift !== legs?.name ? lift : null, heavy ? heavy.name.toLowerCase() : null].filter(Boolean);
    return parts.length ? `${parts.join(" & ")} week` : null;
  };
  const mine = name(week);
  return mine && mine !== name(week === "A" ? "B" : "A") ? mine.charAt(0).toUpperCase() + mine.slice(1) : `Week ${week}`;
}

export interface DayOption {
  key: string;
  label: string;
  /** The workout's day type ("Push"...). */
  dayType: string;
  /** The plan's exercises (none for Cardio: picked at the start). */
  exercises?: string[];
  /** Already trained this week. */
  done: boolean;
}

/** The week's days in Sergio's order (Push, Legs, Pull, then Cardio), marked done when that day
 * type was trained this week, and the first not done as next up. */
export function weekOptions(plans: DayPlan[], week: "A" | "B", doneTypes: Set<string>): { options: DayOption[]; next: string | null } {
  const order = ["Push", "Legs", "Pull"];
  const options: DayOption[] = plans
    .filter((p) => p.week === week)
    .sort((a, b) => order.indexOf(a.dayType) - order.indexOf(b.dayType))
    .map((p) => ({ key: p.id, label: p.name, dayType: p.dayType, exercises: p.exercises, done: doneTypes.has(p.dayType) }));
  options.push({ key: "cardio", label: "Cardio", dayType: "Cardio", done: doneTypes.has("Cardio") });
  return { options, next: options.find((o) => !o.done)?.key ?? null };
}

/** A planned day's starting entries: the warm-up, then the plan's exercises (the ones that exist). */
export function planEntries(exercises: string[], known: Set<string>): Entry[] {
  return [WARM_UP, ...exercises.filter((id) => id !== WARM_UP)].filter((id) => known.has(id)).map((exerciseId) => ({ exerciseId }));
}
