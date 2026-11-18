import { describe, expect, it } from "vitest";
import { limitWords } from "@/lib/game/engine";

describe("limitWords", () => {
  it("counts each Chinese character as a word", () => {
    const r = limitWords("我".repeat(250), 200);
    expect(r.trimmed).toBe(true);
    expect(r.text!.replace(" …", "")).toHaveLength(200);
  });
  it("leaves short text alone", () => expect(limitWords("a b c", 200)).toEqual({ text: "a b c", trimmed: false }));
});
