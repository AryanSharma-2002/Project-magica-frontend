import { describe, expect, it } from "vitest";
import { formatCredits } from "./format";

describe("formatCredits", () => {
  it("formats whole millions of credits to two decimals", () => {
    expect(formatCredits(28_450_000)).toBe("28.45M");
    expect(formatCredits(100_000_000)).toBe("100.00M");
  });

  it("shows <0.01M for a small nonzero balance", () => {
    expect(formatCredits(7_644)).toBe("<0.01M");
  });

  it("shows 0.00M for a zero balance", () => {
    expect(formatCredits(0)).toBe("0.00M");
  });

  it("does not round 0.01M down to <0.01M at the boundary", () => {
    expect(formatCredits(10_000)).toBe("0.01M");
    expect(formatCredits(9_999)).toBe("<0.01M");
  });
});
