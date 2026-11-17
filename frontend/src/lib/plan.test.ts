import { describe, expect, it } from "vitest";

import type { SessionType } from "../api";
import { cardioOptions, currentIndex, isLogged, lastCardio, startingEntries, usualFor } from "./plan";

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
