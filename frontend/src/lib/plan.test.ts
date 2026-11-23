import { describe, expect, it } from "vitest";

import type { DayPlan, SessionType, WeekPlan } from "../api";
import { cardioOptions, currentIndex, cycleView, isLogged, lastCardio, nextWeek, planEntries, startingEntries, usualFor, weekOptions } from "./plan";

const types: SessionType[] = [
  { label: "Push", exercises: ["dips", "bench-press", "warm-up"], lastDate: "2026-11-09", sessions: 20 },
  { label: "Legs", exercises: ["squat", "deadlift", "calf-raises"], lastDate: "2026-11-11", sessions: 20 },
];
const lastLegs = [{ date: "2026-11-11", label: "Legs", entries: [{ exerciseId: "deadlift" }, { exerciseId: "squat" }] }];

describe("plan", () => {
  it("starts with the warm-up, then the day's usual exercises", () => {
    const known = new Set(["warm-up", "dips", "bench-press"]);
    expect(startingEntries("Push", types, [], known).map((e) => e.exerciseId)).toEqual(["warm-up", "dips", "bench-press"]);
    expect(startingEntries(undefined, types, [], known).map((e) => e.exerciseId)).toEqual(["warm-up"]);
  });

  it("starts a Cardio day with the warm-up and the one activity picked", () => {
    const withCardio: SessionType[] = [...types, { label: "Cardio", exercises: ["peloton-ride", "peloton-run", "walk", "warm-up"], lastDate: "2026-11-15", sessions: 5 }];
    const known = new Set(["warm-up", "peloton-ride", "peloton-run", "walk"]);
    expect(startingEntries("Cardio", withCardio, [], known, "walk").map((e) => e.exerciseId)).toEqual(["warm-up", "walk"]);
    const options = cardioOptions(withCardio, new Set(["peloton-ride", "peloton-run", "walk"]));
    expect(options).toEqual(["peloton-ride", "peloton-run", "walk"]);
    const workouts = [
      { date: "2026-11-08", entries: [{ exerciseId: "peloton-run" }] },
      { date: "2026-11-15", entries: [{ exerciseId: "warm-up" }, { exerciseId: "walk" }] },
    ];
    expect(lastCardio(workouts, options)).toBe("walk");
    expect(lastCardio([], options)).toBe("peloton-ride");
  });

  it("puts the heavy lift first on a Legs day", () => {
    expect(usualFor("Legs", types, lastLegs)).toEqual(["squat", "deadlift", "calf-raises"]);
    const lastHeavySquat = [{ ...lastLegs[0], entries: [{ exerciseId: "squat" }, { exerciseId: "deadlift" }] }];
    expect(usualFor("Legs", types, lastHeavySquat)).toEqual(["deadlift", "squat", "calf-raises"]);
  });

  it("knows what's logged and what's being done now", () => {
    expect(isLogged({ exerciseId: "dips" })).toBe(false);
    expect(isLogged({ exerciseId: "warm-up", minutes: 10 })).toBe(true);
    expect(currentIndex([{ exerciseId: "warm-up", done: true }, { exerciseId: "dips" }])).toBe(1);
    expect(currentIndex([{ exerciseId: "dips", done: true }])).toBe(-1);
  });
});

describe("training plans", () => {
  const week = {
    days: [
      { id: "push", name: "Heavy push", kind: "Push" as const, exercises: ["dips", "bar-dips"] },
      { id: "u1", name: "Upper 1", kind: "Upper" as const, exercises: ["bench-press"] },
      { id: "u2", name: "Upper 2", kind: "Upper" as const, exercises: ["chin-ups"] },
      { id: "cardio", name: "Cardio", kind: "Cardio" as const, exercises: [] },
    ],
  };

  it("lists the week's days in order, done ones marked by kind, the first not done next", () => {
    const { options, next } = weekOptions(week, ["Upper", "Cardio"]);
    expect(options.map((o) => [o.label, o.done])).toEqual([
      ["Heavy push", false], ["Upper 1", true], ["Upper 2", false], ["Cardio", true],
    ]);
    expect(next).toBe("push");
    expect(options[3].exercises).toBeUndefined();
  });

  it("moves along the rotation", () => {
    const weeks = [{ id: "A" }, { id: "B" }, { id: "C" }];
    expect(nextWeek(weeks, "A")?.id).toBe("B");
    expect(nextWeek(weeks, "C")?.id).toBe("A");
    expect(nextWeek([{ id: "A" }], "A")).toBeUndefined();
  });

  it("starts with the warm-up and the plan's exercises", () => {
    expect(planEntries(["dips", "nope"], new Set(["warm-up", "dips"]))).toEqual([{ exerciseId: "warm-up" }, { exerciseId: "dips" }]);
  });
});

describe("optional days", () => {
  it("aren't next up while a day that counts is left", () => {
    const week = { days: [
      { id: "ride", name: "Extra ride", kind: "Cardio" as const, exercises: [], optional: true },
      { id: "push", name: "Push", kind: "Push" as const, exercises: [] },
    ] };
    expect(weekOptions(week, []).next).toBe("push");
    expect(weekOptions(week, ["Push"]).next).toBe("ride");
  });
});

describe("the cycle of days", () => {
  const day = (id: string, kind: DayPlan["kind"], exercises: string[] = []): DayPlan => ({ id, name: id, kind, exercises });
  // Sergio's two week types: heavy push, squat legs, light pull, ride; light push, deadlift legs, heavy pull, ride.
  const weeks: WeekPlan[] = [
    { id: "a", name: "A", days: [day("heavy-push", "Push", ["dips", "bench-press"]), day("legs-squat", "Legs", ["squat", "deadlift"]), day("light-pull", "Pull", ["front-lever"]), day("ride-a", "Cardio")] },
    { id: "b", name: "B", days: [day("light-push", "Push", ["bench-press", "ohp"]), day("legs-deadlift", "Legs", ["deadlift", "squat"]), day("heavy-pull", "Pull", ["chin-ups"]), day("ride-b", "Cardio")] },
  ];
  const cardio = new Set(["peloton-ride"]);
  let n = 0;
  const w = (date: string, label: string, ids: string[], planDays?: string[]) =>
    ({ id: `w${n++}`, date, label, entries: ids.map((exerciseId) => ({ exerciseId })), planDays });
  const keys = (days: { key: string }[]) => days.map((d) => d.key);

  it("starts at the first day without workouts", () => {
    expect(keys(cycleView(weeks, [], cardio).next)).toEqual(["heavy-push", "legs-squat", "light-pull", "ride-a"]);
  });

  it("carries a short week over: the next day follows the last workout, not the calendar", () => {
    // Week of Nov 9: light push and deadlift legs only. The next week starts with heavy pull.
    const log = [w("2026-11-10", "Push", ["bench-press", "ohp"]), w("2026-11-12", "Legs", ["deadlift", "squat"])];
    const view = cycleView(weeks, log, cardio);
    expect(keys(view.next)).toEqual(["heavy-pull", "ride-b", "heavy-push", "legs-squat"]);
    expect(view.last.map((l) => keys(l.days))).toEqual([["light-push"], ["legs-deadlift"]]);
  });

  it("uses the day a workout was started from, and wraps around", () => {
    const log = [w("2026-11-20", "Cardio", ["peloton-ride"], ["ride-b"])];
    expect(keys(cycleView(weeks, log, cardio).next)[0]).toBe("heavy-push");
  });

  it("tells the two Cardio days apart by which comes next", () => {
    const log = [w("2026-11-17", "Pull", ["front-lever"]), w("2026-11-18", "Cardio", ["peloton-ride"])];
    const view = cycleView(weeks, log, cardio);
    expect(view.last.map((l) => keys(l.days))).toEqual([["light-pull"], ["ride-a"]]);
    expect(keys(view.next)[0]).toBe("light-push");
  });

  it("a ride after lifting also takes the Cardio day right after", () => {
    const log = [w("2026-11-17", "Pull", ["chin-ups", "peloton-ride"])];
    const view = cycleView(weeks, log, cardio);
    expect(view.last.map((l) => keys(l.days))).toEqual([["heavy-pull", "ride-b"]]);
    expect(keys(view.next)[0]).toBe("heavy-push");
  });

  it("shows the last two workouts, oldest first", () => {
    const log = [w("2026-11-01", "Push", ["dips"]), w("2026-11-03", "Legs", ["squat"]), w("2026-11-05", "Pull", ["front-lever"])];
    expect(cycleView(weeks, log, cardio).last.map((l) => l.workout.date)).toEqual(["2026-11-03", "2026-11-05"]);
  });
});
