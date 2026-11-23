import { describe, expect, it } from "vitest";

import type { SessionType } from "../api";
import { cardioOptions, currentIndex, isLogged, lastCardio, planEntries, startingEntries, usualFor, weekName, weekOptions } from "./plan";

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
  const plans = [
    { id: "A-pull", name: "Light pull", dayType: "Pull" as const, week: "A" as const, exercises: ["full-front-raise"] },
    { id: "A-push", name: "Heavy push", dayType: "Push" as const, week: "A" as const, exercises: ["dips", "bar-dips"] },
    { id: "A-legs", name: "Legs · Squat", dayType: "Legs" as const, week: "A" as const, exercises: ["squat"] },
    { id: "B-legs", name: "Legs · Deadlift", dayType: "Legs" as const, week: "B" as const, exercises: ["deadlift"] },
  ];

  it("names the weeks by their Legs day", () => {
    expect(weekName(plans, "A")).toBe("Squat & heavy push week");
    expect(weekName(plans, "B")).toBe("Deadlift week");
    const both = [...plans, { id: "B-pull", name: "Heavy pull", dayType: "Pull" as const, week: "B" as const, exercises: [] }];
    expect(weekName(both, "B")).toBe("Deadlift & heavy pull week");
    expect(weekName([], "A")).toBe("Week A");
  });

  it("lists the week's days in order, done ones marked, the first not done next", () => {
    const { options, next } = weekOptions(plans, "A", new Set(["Push"]));
    expect(options.map((o) => [o.label, o.done])).toEqual([
      ["Heavy push", true], ["Legs · Squat", false], ["Light pull", false], ["Cardio", false],
    ]);
    expect(next).toBe("A-legs");
  });

  it("starts with the warm-up and the plan's exercises", () => {
    expect(planEntries(["dips", "nope"], new Set(["warm-up", "dips"]))).toEqual([{ exerciseId: "warm-up" }, { exerciseId: "dips" }]);
  });
});

describe("week names", () => {
  it("falls back to letters when both weeks have the same Legs day", () => {
    const same = [
      { week: "A" as const, dayType: "Legs" as const, name: "Legs · Squat" },
      { week: "B" as const, dayType: "Legs" as const, name: "Legs · Squat" },
    ];
    expect(weekName(same, "A")).toBe("Week A");
    expect(weekName(same, "B")).toBe("Week B");
  });
});
