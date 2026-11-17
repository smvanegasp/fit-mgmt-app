import { describe, expect, it } from "vitest";

import { clearDraft, loadDraft, saveDraft } from "./drafts";

describe("set drafts", () => {
  it("keeps the set being dialed in until a set is logged", () => {
    saveDraft("w1|0|squat", { reps: 4, weightLb: 180 }, 2);
    expect(loadDraft("w1|0|squat", 2)).toEqual({ reps: 4, weightLb: 180 });
    // A set was logged since: the draft no longer applies.
    expect(loadDraft("w1|0|squat", 3)).toBeNull();
    clearDraft("w1|0|squat");
    expect(loadDraft("w1|0|squat", 2)).toBeNull();
  });

  it("keeps only the latest drafts", () => {
    for (let i = 0; i < 40; i++) saveDraft(`w|${i}|dips`, { reps: i }, 0);
    expect(loadDraft("w|0|dips", 0)).toBeNull();
    expect(loadDraft("w|39|dips", 0)).toEqual({ reps: 39 });
  });
});
