import { describe, expect, it } from "vitest";

import { clockTime, friendlyDate, minutesText, workoutMinutes } from "./time";

describe("time", () => {
  it("writes clock times", () => {
    expect(clockTime("2026-10-26T17:37:00")).toBe("5:37 PM");
    expect(clockTime("2026-10-26T00:05:00")).toBe("12:05 AM");
    expect(clockTime("2026-10-26T12:00:00")).toBe("12:00 PM");
  });

  it("writes durations", () => {
    expect(minutesText(45)).toBe("45 min");
    expect(minutesText(60)).toBe("1 h");
    expect(minutesText(88)).toBe("1 h 28 min");
  });

  it("writes friendly dates", () => {
    expect(friendlyDate("2026-10-30", "2026-10-30")).toBe("Today");
    expect(friendlyDate("2026-10-29", "2026-10-30")).toBe("Yesterday");
    expect(friendlyDate("2026-10-12", "2026-10-30")).toBe("Oct 12");
    expect(friendlyDate("2025-12-29", "2026-10-30")).toBe("Dec 29, 2025");
  });
});

describe("workoutMinutes", () => {
  it("prefers the training minutes of a day with separate sessions", () => {
    expect(workoutMinutes({ startedAt: "2026-10-29T12:44:00", endedAt: "2026-10-29T18:54:00", durationMin: 75 })).toBe(75);
    expect(workoutMinutes({ startedAt: "2026-10-29T12:00:00", endedAt: "2026-10-29T13:30:00" })).toBe(90);
    expect(workoutMinutes({ startedAt: "2026-10-29T12:00:00" })).toBeNull();
  });
});
