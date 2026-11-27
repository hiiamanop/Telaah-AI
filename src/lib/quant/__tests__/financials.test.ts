import { describe, expect, it } from "vitest";
import { latestCompletedQuarterEnd, quarterLabel } from "../financials";
import {
  getFundamentalUpdate,
  hasNewerFundamentalUpdate,
} from "../../market/financial-overrides";

describe("financial period labels", () => {
  it("labels Yahoo 3M period ends as quarters", () => {
    expect(quarterLabel("2026-06-30")).toBe("Q2 2026");
    expect(quarterLabel("2026-09-30")).toBe("Q3 2026");
    expect(quarterLabel("2026-12-31")).toBe("Q4 2026");
    expect(quarterLabel(null)).toBeNull();
    expect(quarterLabel("not-a-date")).toBeNull();
  });

  it("finds the latest completed calendar quarter", () => {
    expect(
      latestCompletedQuarterEnd(new Date("2026-11-27T00:00:00Z"))
    ).toBe("2026-09-30");
    expect(
      latestCompletedQuarterEnd(new Date("2026-08-15T00:00:00Z"))
    ).toBe("2026-06-30");
    expect(
      latestCompletedQuarterEnd(new Date("2026-01-15T00:00:00Z"))
    ).toBe("2025-12-31");
    expect(
      latestCompletedQuarterEnd(new Date("2026-04-01T00:00:00Z"))
    ).toBe("2026-03-31");
  });
});

describe("financial overrides", () => {
  it("loads the BUMI 9M update used when the provider lags", () => {
    const update = getFundamentalUpdate("BUMI");
    expect(update?.periodEnd).toBe("2026-09-30");
    expect(update?.periodType).toBe("cumulative");
    expect(update?.summary).toContain("Rp2,66");
  });

  it("forces a refresh when the manual period is newer than the cache", () => {
    expect(hasNewerFundamentalUpdate("BUMI", undefined)).toBe(true);
    expect(hasNewerFundamentalUpdate("BUMI", "2026-06-30")).toBe(true);
    expect(hasNewerFundamentalUpdate("BUMI", "2026-09-30")).toBe(false);
    expect(hasNewerFundamentalUpdate("BBCA", undefined)).toBe(false);
  });
});
