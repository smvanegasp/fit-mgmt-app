import { describe, expect, it } from "vitest";

import { calendarMonths, monthTicks, niceTicks, rangeStart, streaks, valueText, weeklyCounts } from "./progress";

describe("rangeStart", () => {
  it("starts on the 1st so whole months show", () => {
    expect(rangeStart("6M", "2026-10-30", "2025-09-05")).toBe("2026-05-01");
    expect(rangeStart("3M", "2026-10-30", "2025-09-05")).toBe("2026-08-01");
    expect(rangeStart("1Y", "2026-10-30", "2025-09-05")).toBe("2025-11-01");
    expect(rangeStart("All", "2026-10-30", "2025-09-05")).toBe("2025-09-05");
  });
});

describe("weeklyCounts", () => {
  it("counts each week by day type, empty weeks included", () => {
    const weeks = weeklyCounts(
      [
        { date: "2026-10-12", type: "Push" },
        { date: "2026-10-14", type: "Legs" },
        { date: "2026-10-27", type: "Pull" },
        { date: "2026-10-29", type: "Pull" },
      ],
      "2026-10-13",
      "2026-10-30",
    );
    expect(weeks.map((w) => [w.monday, w.total])).toEqual([["2026-10-12", 2], ["2026-10-19", 0], ["2026-10-26", 2]]);
    expect(weeks[2].counts).toEqual({ Push: 0, Legs: 0, Pull: 2, Cardio: 0 });
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
    // Once it's over without reaching the goal, the streak is gone.
    expect(streaks(days, "2026-11-03").current).toBe(0);
  });

  it("an empty week breaks it", () => {
    const days = [...week("2026-10-05", 3), ...week("2026-10-19", 3)];
    expect(streaks(days, "2026-10-25")).toEqual({ current: 1, longest: 1 });
    expect(streaks([], "2026-10-25")).toEqual({ current: 0, longest: 0 });
  });
});

describe("calendarMonths", () => {
  it("lays out months Monday first, newest first", () => {
    const months = calendarMonths("2025-12-15", "2026-01-10");
    expect(months.map((m) => m.label)).toEqual(["Jan", "Dec 2025"]);
    // Jan 1 2026 is a Thursday.
    expect(months[0].weeks[0]).toEqual([null, null, null, "2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04"]);
    expect(months[0].weeks.at(-1)).toEqual(["2026-01-26", "2026-01-27", "2026-01-28", "2026-01-29", "2026-01-30", "2026-01-31", null]);
    expect(months[1].weeks.flat().filter(Boolean)).toHaveLength(31);
  });
});

describe("valueText", () => {
  it("shows added weight with a plus", () => {
    expect(valueText(185, "lb")).toBe("185 lb");
    expect(valueText(90, "lb", true)).toBe("+90 lb");
    expect(valueText(12, "reps")).toBe("12 reps");
  });
});

describe("axis ticks", () => {
  it("rounds to clean steps around the data", () => {
    expect(niceTicks(150, 230)).toEqual([140, 160, 180, 200, 220, 240]);
    expect(niceTicks(0, 5)).toEqual([0, 2, 4, 6]);
    expect(niceTicks(90, 90)).toEqual([89, 89.5, 90, 90.5, 91]);
  });

  it("labels months, thinned, keeping the newest", () => {
    expect(monthTicks("2026-05-01", "2026-10-30").map((t) => t.label)).toEqual(["May", "Jun", "Jul", "Aug", "Sep", "Oct"]);
    expect(monthTicks("2025-09-05", "2026-10-30", 5).map((t) => t.label)).toEqual(["Oct", "2026", "Apr", "Jul", "Oct"]);
  });
});
