import { describe, expect, it } from "vitest";

import { mainSessions, topSeries } from "./series";

const session = (date: string, sets: object[]) => ({ date, workoutId: `${date}-1`, entry: { exerciseId: "x", sets } });

describe("topSeries", () => {
  it("plots each session's top working weight, oldest first", () => {
    const s = topSeries([
      session("2026-11-05", [{ reps: 4, weightLb: 180 }, { reps: 8, weightLb: 150 }]),
      session("2026-10-01", [{ reps: 5, weightLb: 170 }]),
    ], { load: "barbell", measure: "reps", barLb: 45 })!;
    expect(s.points.map((p) => [p.date, p.value])).toEqual([["2026-10-01", 170], ["2026-11-05", 180]]);
    expect(s.title).toBe("Top weight");
    expect(s.format(180)).toBe("180 lbs plates (+45 bar)");
  });

  it("leaves out drop sets and body-weight days of a weighted lift", () => {
    const s = topSeries([
      session("2026-10-01", [{ reps: 4, weightLb: 90 }, { reps: 9, weightLb: 0, drop: true }]),
      session("2026-10-08", [{ reps: 10 }]),
    ], { load: "added", measure: "reps", barLb: 0 })!;
    expect(s.points.map((p) => p.value)).toEqual([90]);
  });

  it("uses reps or seconds for body-weight work, and nothing for runs", () => {
    expect(topSeries([session("2026-10-01", [{ reps: 8 }, { reps: 10 }])], { load: "bodyweight", measure: "reps", barLb: 0 })!.points[0].value).toBe(10);
    expect(topSeries([session("2026-10-01", [{ seconds: 20 }])], { load: "none", measure: "seconds", barLb: 0 })!.title).toBe("Longest hold");
    expect(topSeries([session("2026-10-01", [])], { load: "none", measure: "run", barLb: 0 })).toBeNull();
  });

  it("plots a main lift's first-lift sessions only, an accessory's all", () => {
    const squat = (date: string, lb: number, role: "first" | "later") => ({ date, workoutId: date, role, entry: { exerciseId: "squat", sets: [{ reps: 4, weightLb: lb }] } });
    const lift = { load: "barbell" as const, measure: "reps" as const, barLb: 45 };
    // Squat after deadlift (155) is left out of the line.
    const s = topSeries([squat("2026-10-23", 180, "first"), squat("2026-10-28", 155, "later"), squat("2026-11-05", 180, "first")], lift)!;
    expect(s.points.map((p) => p.value)).toEqual([180, 180]);
    // First once in many sessions (an accessory): every session stays.
    const rdl = [squat("2026-08-15", 155, "first"), ...["2026-09-01", "2026-09-08", "2026-09-15", "2026-09-22"].map((d) => squat(d, 155, "later"))];
    expect(mainSessions(rdl)).toHaveLength(5);
    expect(topSeries(rdl, lift)!.points).toHaveLength(5);
  });

  it("plots a Peloton class's output, or a run's distance", () => {
    const ride = (date: string, outputKj: number) => ({ date, workoutId: date, entry: { exerciseId: "peloton-ride", distanceMi: 14, peloton: { outputKj } } });
    const s = topSeries([ride("2026-11-15", 526), ride("2026-11-01", 291)], { load: "none", measure: "run", barLb: 0 })!;
    expect([s.title, s.points.map((p) => p.value)]).toEqual(["Total output", [291, 526]]);
    const run = topSeries([{ date: "2026-10-01", workoutId: "w", entry: { exerciseId: "walk", distanceMi: 2.5 } }], { load: "none", measure: "run", barLb: 0 })!;
    expect([run.title, run.format(2.5)]).toEqual(["Distance", "2.5 mi"]);
  });
});
