import { describe, expect, it } from "vitest";

import { groupByMonth, groupByWeek, longDate, weekLabel, weekStart } from "./weeks";

describe("weeks", () => {
  it("starts weeks on Monday", () => {
    expect(weekStart("2026-10-29")).toBe("2026-10-26"); // Thursday
    expect(weekStart("2026-10-26")).toBe("2026-10-26"); // Monday
    expect(weekStart("2026-11-01")).toBe("2026-10-26"); // Sunday
  });

  it("labels weeks", () => {
    const today = "2026-10-30";
    expect(weekLabel("2026-10-26", today)).toBe("This week");
    expect(weekLabel("2026-10-19", today)).toBe("Last week");
    expect(weekLabel("2026-10-12", today)).toBe("Oct 12 – 18");
    expect(weekLabel("2026-09-28", today)).toBe("Sep 28 – Oct 4");
    expect(weekLabel("2025-12-29", today)).toBe("Dec 29, 2025 – Jan 4");
  });

  it("groups newest week first", () => {
    const groups = groupByWeek([{ date: "2026-10-20" }, { date: "2026-10-29" }, { date: "2026-10-27" }], "2026-10-30");
    expect(groups.map((g) => [g.label, g.items.map((w) => w.date)])).toEqual([
      ["This week", ["2026-10-29", "2026-10-27"]],
      ["Last week", ["2026-10-20"]],
    ]);
  });

  it("writes long dates", () => {
    expect(longDate("2026-10-26", "2026-10-30")).toBe("Monday, Oct 26");
    expect(longDate("2025-12-29", "2026-10-30")).toBe("Monday, Dec 29, 2025");
  });
});

describe("groupByMonth", () => {
  it("puts weeks under the month of their newest workout", () => {
    const weeks = groupByWeek(
      [{ date: "2026-10-29" }, { date: "2026-10-01" }, { date: "2026-09-29" }, { date: "2026-09-10" }, { date: "2025-12-30" }],
      "2026-10-30",
    );
    const months = groupByMonth(weeks, "2026-10-30");
    expect(months.map((m) => [m.label, m.count, m.weeks.length])).toEqual([
      ["October", 3, 2],
      ["September", 1, 1],
      ["December 2025", 1, 1],
    ]);
  });
});
