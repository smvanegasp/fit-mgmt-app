import { describe, expect, it } from "vitest";

import type { Step } from "../api";
import { shortDate, stepDates, streaks, weekCounts, weekRows, weekState, weekText } from "./progress";

describe("weekRows", () => {
  it("lists weeks newest first, Monday to Sunday", () => {
    const rows = weekRows("2026-10-30", 2);
    expect(rows.map((r) => r.monday)).toEqual(["2026-10-26", "2026-10-19"]);
    expect(rows[0].days).toEqual(["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01"]);
  });

  it("counts workouts, strength days and cardio days per week", () => {
    expect(weekCounts([
      { date: "2026-10-26", type: "Push" }, { date: "2026-11-01", type: "Cardio", cardio: true },
      { date: "2026-11-02", type: "Legs", cardio: true },
    ])).toEqual(new Map([
      ["2026-10-26", { workouts: 2, strength: 1, cardio: 1 }],
      ["2026-11-02", { workouts: 1, strength: 1, cardio: 1 }],
    ]));
  });
});

describe("the weekly rule", () => {
  it("4 days grow the streak, 2 or 3 hold it, 0 or 1 miss", () => {
    expect([0, 1, 2, 3, 4, 5].map(weekState)).toEqual(["miss", "miss", "hold", "hold", "grow", "grow"]);
    expect(weekText(3)).toBe("3 days: held");
    expect(weekText(1)).toBe("1 day: missed");
  });
});

describe("streaks", () => {
  const week = (monday: string, n: number) => Array.from({ length: n }, (_, i) => ({ date: `${monday.slice(0, 8)}${String(Number(monday.slice(8)) + i).padStart(2, "0")}` }));

  it("counts weeks of 4+ days; weeks of 2 or 3 hold it without adding", () => {
    const days = [...week("2026-09-07", 4), ...week("2026-09-14", 3), ...week("2026-09-21", 4), ...week("2026-09-28", 2), ...week("2026-10-05", 5)];
    expect(streaks(days, "2026-10-11")).toMatchObject({ current: 3, longest: 3 });
  });

  it("any kind of day counts", () => {
    const days = ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08"].map((date, i) => ({ date, type: i ? "Cardio" : "Legs" }));
    expect(streaks(days, "2026-10-11").current).toBe(1);
  });

  it("this week doesn't break the streak until it's over", () => {
    const days = [...week("2026-10-12", 4), ...week("2026-10-19", 4), ...week("2026-10-26", 1)];
    expect(streaks(days, "2026-10-28")).toMatchObject({ current: 2, longest: 2 });
    expect(streaks(days, "2026-11-03").current).toBe(0);
  });

  it("a week under 2 days ends it without a shield", () => {
    const days = [...week("2026-10-05", 4), ...week("2026-10-12", 1), ...week("2026-10-19", 4)];
    expect(streaks(days, "2026-10-25")).toMatchObject({ current: 1, longest: 1 });
    expect(streaks([], "2026-10-25")).toMatchObject({ current: 0, longest: 0 });
  });
});

describe("dates", () => {
  const step = (...dates: string[]): Step => ({
    scheme: { sets: [4, 4], each: false, seconds: false },
    times: 1,
    sessions: dates.map((date) => ({ date, workoutId: date, result: "reached" })),
  });

  it("shows a step's date range compactly", () => {
    expect(stepDates(step("2026-09-01", "2026-09-08"), "2026-10-30")).toBe("Sep 1 – 8");
    expect(stepDates(step("2026-09-29", "2026-10-06"), "2026-10-30")).toBe("Sep 29 – Oct 6");
    expect(stepDates(step("2025-12-29"), "2026-10-30")).toBe("Dec 29, 2025");
    expect(shortDate("2026-10-26")).toBe("Oct 26");
  });
});
