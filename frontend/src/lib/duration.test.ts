import { describe, expect, it } from "vitest";

import { formatDuration } from "./duration";

describe("formatDuration", () => {
  it("shows minutes and seconds under an hour", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(247)).toBe("4:07");
    expect(formatDuration(3599)).toBe("59:59");
  });

  it("adds hours from one hour on", () => {
    expect(formatDuration(3600)).toBe("1:00:00");
    expect(formatDuration(3729)).toBe("1:02:09");
  });

  it("ignores fractions and negative clock drift", () => {
    expect(formatDuration(61.9)).toBe("1:01");
    expect(formatDuration(-5)).toBe("0:00");
  });
});
