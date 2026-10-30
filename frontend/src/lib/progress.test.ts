import { describe, expect, it } from "vitest";

import type { Step } from "../api";
import { shortDate, stepDates, streaks, weekCounts, weekRows } from "./progress";

describe("weekRows", () => {
  it("lists weeks newest first, Monday to Sunday", () => {
    const rows = weekRows("2026-10-30", 2);
    expect(rows.map((r) => r.monday)).toEqual(["2026-10-26", "2026-10-19"]);
    expect(rows[0].days).toEqual(["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01"]);
  });

  it("counts workouts per week", () => {
    expect(weekCounts([{ date: "2026-10-26" }, { date: "2026-11-01" }, { date: "2026-11-02" }])).toEqual(
      new Map([["2026-10-26", 2], ["2026-11-02", 1]]),
    );
  });
});

describe("streaks", () => {
  const week = (monday: string, n: number) => Array.from({ length: n }, (_, i) => ({ date: `${monday.slice(0, 8)}${String(Number(monday.slice(8)) + i).padStart(2, "0")}` }));

  it("counts weeks in a row that reach the goal", () => {
    const days = [...week("2026-09-07", 3), ...week("2026-09-14", 2), ...week("2026-09-21", 3), ...week("2026-09-28", 4), ...week("2026-10-05", 3)];
    expect(streaks(days, "2026-10-11")).toEqual({ current: 3, longest: 3 });
  });

  it("this week doesn't break the streak until it's over", () => {
    const days = [...week("2026-10-12", 3), ...week("2026-10-19", 3), ...week("2026-10-26", 1)];
    expect(streaks(days, "2026-10-28")).toEqual({ current: 2, longest: 2 });
    expect(streaks(days, "2026-11-03").current).toBe(0);
  });

  it("an empty week breaks it", () => {
    const days = [...week("2026-10-05", 3), ...week("2026-10-19", 3)];
    expect(streaks(days, "2026-10-25")).toEqual({ current: 1, longest: 1 });
    expect(streaks([], "2026-10-25")).toEqual({ current: 0, longest: 0 });
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
