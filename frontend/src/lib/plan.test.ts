import { describe, expect, it } from "vitest";

import type { SessionType } from "../api";
import { cardioOptions, currentIndex, isLogged, lastCardio, nextWeek, planEntries, startingEntries, usualFor, weekOptions } from "./plan";

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
