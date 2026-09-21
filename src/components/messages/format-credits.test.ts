import { describe, expect, it } from "vitest";
import { formatCredits } from "./format-credits";

describe("formatCredits", () => {
  it("formats whole microcredits as millions with two decimals", () => {
    expect(formatCredits(28_450_000)).toBe("28.45M");
  });

  it("shows the <0.01M floor for small nonzero amounts", () => {
    expect(formatCredits(7_644)).toBe("<0.01M");
  });

  it("shows 0.00M for exactly zero", () => {
    expect(formatCredits(0)).toBe("0.00M");
  });

  it("formats a mid-size amount", () => {
    expect(formatCredits(150_000)).toBe("0.15M");
  });
});
