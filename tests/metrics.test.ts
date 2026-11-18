import { describe, expect, it } from "vitest";
import { analyseMessage } from "@/lib/analysis/metrics";

describe("message heuristics", () => {
  it("detects silence requests and assurances", () => {
    const s = analyseMessage("Stay silent. I won't say a word, you have my word.");
    expect(s.silenceRequest).toBe(true);
    expect(s.assurance).toBe(true);
    expect(s.statedIntent).toBe("DENY");
    expect(s.requestedAction).toBe("DENY");
  });
  it("detects threats and confess persuasion", () => {
    const s = analyseMessage("You should confess. If you rat on me later, you'll regret it.");
    expect(s.threat).toBe(true);
    expect(s.confessPersuasion).toBe(true);
  });
});

describe("Chinese heuristics and word limit", () => {
  it("detects Chinese silence requests and assurances", () => {
    const s = analyseMessage("我们一起否认到底，我不会出卖你，你可以相信我。");
    expect(s.silenceRequest).toBe(true);
    expect(s.assurance).toBe(true);
    expect(s.statedIntent).toBe("DENY");
  });
});
