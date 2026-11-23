import type { Entry, Exercise, Load, Scheme, SetData, Workout } from "../api";

/** Weight as Sergio writes it: "170" (plates, for barbells), "25 each", "BW" for none. */
export function weightText(set: SetData, load: Load): string {
  if (load === "bodyweight" || load === "none") return "";
  if (set.weightLb === undefined) return "";
  if (load === "added" && set.weightLb === 0) return "BW";
  return `${set.weightLb}${set.each ? " each" : ""}`;
}

function amount(set: SetData): string {
  return set.seconds !== undefined ? `${set.seconds}s` : `${set.reps ?? 0}`;
}

/** "5×5 @ 170, 3×8 @ 150" — consecutive identical sets grouped; drop ladders as "drop 90-70-45: 4-3-3". */
export function summarizeSets(sets: SetData[], load: Load): string {
  const parts: string[] = [];
  let i = 0;
  while (i < sets.length) {
    const set = sets[i];
    if (set.drop) {
      const ladder: SetData[] = [];
      while (i < sets.length && sets[i].drop) ladder.push(sets[i++]);
      parts.push(`drop ${ladder.map((s) => s.weightLb ?? 0).join("-")}: ${ladder.map(amount).join("-")}`);
      continue;
    }
    let n = 1;
    while (
      i + n < sets.length &&
      !sets[i + n].drop &&
      amount(sets[i + n]) === amount(set) &&
      sets[i + n].weightLb === set.weightLb &&
      sets[i + n].detail === set.detail
    )
      n++;
    const weight = weightText(set, load);
    parts.push(`${n}×${amount(set)}${weight ? ` @ ${weight}` : ""}${set.detail ? ` (${set.detail})` : ""}`);
    i += n;
  }
  return parts.join(", ");
}

/** "5×4 @ 180" or "3×4, 1×3 @ 90" for a target. */
export function schemeText(scheme: Scheme, load: Load): string {
  const sets: SetData[] = scheme.sets.map((n) =>
    scheme.seconds ? { seconds: n, weightLb: scheme.weightLb, each: scheme.each } : { reps: n, weightLb: scheme.weightLb, each: scheme.each },
  );
  const parts = summarizeSets(sets, load).split(", ");
  // Same weight on every group: say it once at the end.
  const weight = parts[0].includes(" @ ") ? parts[0].split(" @ ")[1] : "";
  return parts.map((p) => p.split(" @ ")[0]).join(", ") + (weight ? ` @ ${weight}` : "");
}

/** Whether today's sets already reach the target: as many total reps (or seconds) at its weight or more. */
export function reachesTarget(sets: SetData[], scheme: Scheme): boolean {
  const done = sets
    .filter((s) => !s.drop && !s.detail && (s.weightLb ?? 0) >= (scheme.weightLb ?? 0))
    .reduce((sum, s) => sum + ((scheme.seconds ? s.seconds : s.reps) ?? 0), 0);
  return done >= scheme.sets.reduce((a, b) => a + b, 0);
}

/**
 * Where sets sit on Sergio's ladder (3x2, 4x2, 5x2, 3x3, ... 4x5, 5x5): the most reps reached by at
 * least `minSets` sets, then how many sets reach it. Same as the server's `rung`.
 */
export function rung(reps: number[], minSets: number): [number, number] {
  let best: [number, number] = [0, 0];
  for (const r of new Set(reps)) {
    const n = reps.filter((x) => x >= r).length;
    if (n >= minSets && (r > best[0] || (r === best[0] && n > best[1]))) best = [r, n];
  }
  return best;
}

/**
 * How an exercise moves up (Sergio, 2026-11-23): "heavy" climbs 3x2, 4x2, 5x2, 3x3 ... 5x5, then more
 * weight; "reps" (accessories) climbs 3x6, 3x7 ... 3x10, then more weight.
 */
export type Progression = "heavy" | "reps";
export const HEAVY_TOP = 5; // 5x5
export const REPS_TOP = 10; // 3x10
export const REPS_START = 6; // 3x6 at the new weight

/** Whether reps at the target's weight are a higher rung than the target. Heavy: more sets of its
 * reps, or more reps (5x4 -> 3x5). Reps: only more reps at 3 sets; below 3 sets, reaching 3 is the
 * step. Same as the server's `goes_up`. */
export function goesUp(done: number[], target: number[], style: Progression = "heavy"): boolean {
  if (target.length === 0) return false;
  const floor = Math.min(3, target.length);
  if (style === "reps") {
    const done3 = rung(done, 3)[0];
    const target3 = rung(target, 3)[0];
    if (target3 === 0) return done3 > 0 || rung(done, floor)[0] > rung(target, floor)[0];
    return done3 > target3;
  }
  const [r, n] = rung(done, floor);
  const [tr, tn] = rung(target, floor);
  return r > tr || (r === tr && n > tn);
}

/** The next rung after a target, to aim for once it's been reached 3 times, or null when the next
 * step is more weight (past 5x5 heavy, or 3x10 reps). Heavy: one more set, or past 5 sets one more
 * rep at 3 sets (5x4 -> 3x5). Reps: one more rep at 3 sets. */
export function nextRung(scheme: Scheme, style: Progression = "heavy"): Scheme | null {
  const [r, n] = rung(scheme.sets, Math.min(3, scheme.sets.length));
  if (style === "reps") {
    const at3 = rung(scheme.sets, 3)[0];
    if (at3 >= REPS_TOP) return null;
    return { ...scheme, sets: Array(3).fill(at3 ? at3 + 1 : Math.max(r, REPS_START)) };
  }
  if (r >= HEAVY_TOP && n >= 5) return null;
  const sets = n < 5 ? Array(n + 1).fill(r) : Array(3).fill(r + 1);
  return { ...scheme, sets };
}

/** "go up: try 4x3 @ 180 or more weight" / "go up: more weight, back to 3x6" / "go up: more weight". */
export function goUpText(scheme: Scheme, style: Progression, load: Exercise["load"]): string {
  const next = nextRung(scheme, style);
  if (next) return `go up: try ${schemeText(next, load)} or more weight`;
  return style === "reps" ? `go up: more weight, back to 3x${REPS_START}` : "go up: more weight";
}

export type Congrats = { kind: "reached" } | { kind: "up"; scheme: Scheme };

/**
 * The congrats a newly logged set earns (Sergio, 2026-11-19 and 11-21): going up (a heavier set,
 * or a higher rung at the target's weight) gets "Went up"; reaching the target gets "Target
 * crushed", except once it's time to go up (doing it again isn't the news then). Each fires once.
 */
export function congratsFor(before: SetData[], after: SetData[], target: Scheme, times: number, goal: number, style: Progression = "heavy"): Congrats | null {
  const work = (sets: SetData[]) => sets.filter((s) => !s.drop && !s.detail);
  const value = (s: SetData) => (target.seconds ? s.seconds : s.reps) ?? 0;
  const weight = target.weightLb ?? 0;
  const top = (sets: SetData[]) => Math.max(0, ...work(sets).map((s) => s.weightLb ?? 0));
  if (top(after) > weight && top(before) <= weight) {
    const heaviest = top(after);
    const at = work(after).filter((s) => (s.weightLb ?? 0) === heaviest);
    return { kind: "up", scheme: { ...target, weightLb: heaviest, sets: at.map(value) } };
  }
  const atTarget = (sets: SetData[]) => work(sets).filter((s) => (s.weightLb ?? 0) === weight).map(value);
  if (goesUp(atTarget(after), target.sets, style) && !goesUp(atTarget(before), target.sets, style)) {
    return { kind: "up", scheme: { ...target, sets: atTarget(after) } };
  }
  if (times < goal && !reachesTarget(before, target) && reachesTarget(after, target)) return { kind: "reached" };
  return null;
}

/**
 * What the set logger starts with: the last set logged today, otherwise the set at the same
 * position last time (so the 4th set suggests last time's 4th), otherwise empty. When the target
 * is heavier than last time (last time was a light day), the first set starts from the target.
 */
export function nextSet(
  today: SetData[],
  lastTime: SetData[] | undefined,
  exercise: Pick<Exercise, "load" | "measure">,
  target?: Scheme,
): SetData {
  const work = today.filter((s) => !s.drop);
  const lastTop = Math.max(0, ...(lastTime ?? []).filter((s) => !s.drop).map((s) => s.weightLb ?? 0));
  const fromTarget: SetData[] | undefined = target && (target.weightLb ?? 0) > lastTop
    ? target.sets.map((n) => (target.seconds ? { seconds: n, weightLb: target.weightLb } : { reps: n, weightLb: target.weightLb }))
    : undefined;
  const previous = (fromTarget ?? lastTime ?? []).filter((s) => !s.drop);
  const source = work.at(-1) ?? previous[0];
  // Where last session changed weight (heavy sets -> volume sets), follow it.
  const fromLast = previous[work.length];
  const changed = work.length > 0 && fromLast && fromLast.weightLb !== previous[work.length - 1]?.weightLb;
  const pick = changed ? fromLast : source;
  const base: SetData = exercise.measure === "seconds" ? { seconds: pick?.seconds ?? 10 } : { reps: pick?.reps ?? 5 };
  if (exercise.load !== "bodyweight" && exercise.load !== "none") {
    base.weightLb = pick?.weightLb ?? 0;
    if (exercise.load === "dumbbell" && (pick?.each ?? true)) base.each = true;
  }
  return base;
}

/** The drop ladder to suggest: last time's weights, else Sergio's usual 90-70-45-25-0. */
export function ladderWeights(lastTime: SetData[] | undefined): number[] {
  const drops = (lastTime ?? []).filter((s) => s.drop).map((s) => s.weightLb ?? 0);
  return drops.length > 1 ? drops : [90, 70, 45, 25, 0];
}

/** Total lifted, counting the bar for barbell lifts and both hands for "each" (drop sets too). */
export function volume(sets: SetData[], exercise: Pick<Exercise, "load" | "barLb">): number {
  return sets.reduce((sum, s) => {
    if (s.reps === undefined || s.weightLb === undefined) return sum;
    const weight = (s.weightLb + (exercise.load === "barbell" ? exercise.barLb : 0)) * (s.each ? 2 : 1);
    return sum + weight * s.reps;
  }, 0);
}

export function setCount(entries: Entry[]): number {
  return entries.reduce((n, e) => n + (e.sets?.length ?? 0) + (e.problems?.length ?? 0) + (e.segments?.length ? 1 : 0), 0);
}

/** Old day names and the day type they are now (2026-10-30: one Legs day; front lever and
 * climbing are Pull; runs are Cardio). */
const DAY_TYPE: Record<string, string> = { Squat: "Legs", Deadlift: "Legs", "Front lever": "Pull", Climb: "Pull", Run: "Cardio" };

export function dayType(label: string): string {
  const main = label.split(" + ")[0];
  return DAY_TYPE[main] ?? main;
}

/**
 * A workout's name everywhere it's shown (Sergio, 2026-11-11: the stored names were inconsistent):
 * its day type and the first exercise done, "Legs · Deadlift". The warm-up doesn't count.
 */
export function workoutTitle(workout: Pick<Workout, "label" | "entries">, names: Map<string, string>): string {
  const type = dayType(workout.label || "Workout");
  const first = (workout.entries ?? []).find((e) => e.exerciseId !== "warm-up");
  const name = first && names.get(first.exerciseId);
  return name ? `${type} · ${name}` : type;
}

/**
 * Which lift goes heavy on the next Legs day: the one that was light last time. On a Legs day the
 * heavy lift comes first, so the last Legs day's first squat or deadlift was its heavy one.
 */
export function heavyNext(workouts: Pick<Workout, "date" | "label" | "entries">[]): "squat" | "deadlift" | null {
  const lastLegs = [...workouts].sort((a, b) => b.date.localeCompare(a.date)).find((w) => dayType(w.label) === "Legs");
  const first = lastLegs?.entries?.find((e) => e.exerciseId === "squat" || e.exerciseId === "deadlift");
  if (!first) return null;
  return first.exerciseId === "squat" ? "deadlift" : "squat";
}

/**
 * The rotation day due next: among the day types of the last few weeks (Push, Legs, Pull), the
 * one done longest ago. Cardio is once a week on the side, so it's left out.
 */
export function nextUp(workouts: Pick<Workout, "date" | "label">[], today: string): { label: string; lastDate: string } | null {
  const since = new Date(`${today}T12:00:00`);
  since.setDate(since.getDate() - 21);
  const cutoff = since.toISOString().slice(0, 10);
  const last = new Map<string, string>();
  for (const w of workouts) {
    const main = dayType(w.label);
    if (w.date < cutoff || main === "Cardio") continue;
    if (!last.has(main) || last.get(main)! < w.date) last.set(main, w.date);
  }
  if (last.size < 2) return null;
  const [label, lastDate] = [...last.entries()].sort((a, b) => a[1].localeCompare(b[1]))[0];
  return { label, lastDate };
}
