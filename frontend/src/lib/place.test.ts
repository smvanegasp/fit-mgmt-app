import { describe, expect, it } from "vitest";

import { lastPlace, rememberPlace } from "./place";

describe("place", () => {
  it("remembers the last place, ignoring Settings", () => {
    expect(lastPlace()).toBe("Train");
    rememberPlace("progress");
    rememberPlace("settings");
    expect(lastPlace()).toBe("Progress");
    rememberPlace("Exercise");
    expect(lastPlace()).toBe("Exercise");
  });
});
