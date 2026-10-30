import { describe, expect, it } from "vitest";

import type { Note } from "../api";
import { groupCues, orderCues } from "./cues";

const cue = (id: string, extra: Partial<Note> = {}): Note => ({
  id, exerciseId: "squat", text: id, date: "2026-01-01", sessions: 1, hidden: false, source: "whatsapp", ...extra,
});

describe("cues", () => {
  it("go setup, brace, lift, then unplaced; by importance, then the most repeated", () => {
    const cues = [
      cue("lift-2", { section: "lift", rank: 2 }),
      cue("loose", { sessions: 9 }),
      cue("lift-1", { section: "lift", rank: 1 }),
      cue("setup-1", { section: "setup", rank: 1 }),
      cue("brace-new", { section: "brace", sessions: 3 }),
      cue("brace-1", { section: "brace", rank: 1 }),
    ];
    expect(orderCues(cues).map((c) => c.id)).toEqual(["setup-1", "brace-1", "brace-new", "lift-1", "lift-2", "loose"]);
    expect(groupCues(cues).map((g) => [g.label, g.cues.length])).toEqual([["Setup", 1], ["Brace & breathe", 2], ["Lift", 2], ["Other", 1]]);
  });

  it("aren't labeled when none is placed", () => {
    expect(groupCues([cue("a"), cue("b", { sessions: 4 })])).toEqual([{ label: null, cues: [cue("b", { sessions: 4 }), cue("a")] }]);
  });
});
