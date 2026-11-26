import { describe, expect, it } from "vitest";
import { buildFeatures, researchMatrix, runResearch } from "../research";
import type { DailyTransaction } from "@/lib/sectors/types";

function series(symbol: string, length: number): DailyTransaction[] {
  return Array.from({ length }, (_, index) => {
    const date = new Date(Date.UTC(2025, 0, 1 + index))
      .toISOString()
      .slice(0, 10);
    const close = 1000 + index * 0.5 + (index % 2 === 0 ? 8 : -8);
    return {
      symbol,
      date,
      open: close - 2,
      high: close + 3,
      low: close - 5,
      close,
      volume: 6_000_000,
    };
  });
}

function scenario() {
  const stock = series("BRIS", 62);
  stock[60] = {
    ...stock[60],
    open: 1040,
    high: 1080,
    low: 1040,
    close: 1070,
    volume: 18_000_000,
  };
  stock[61] = {
    ...stock[61],
    open: 1080,
    high: 1090,
    low: 1070,
    close: 1085,
    volume: 9_000_000,
  };
  const features = buildFeatures("BRIS", stock);
  const dates = stock.map((candle) => candle.date);
  const regime = new Map(dates.map((date) => [date, true]));
  return { features, dates, regime };
}

describe("BSJP signal research", () => {
  it("builds features only when there is a next session", () => {
    const { features } = scenario();
    expect(features.length).toBeGreaterThan(0);
    expect(features[features.length - 1].nextOpen).toBe(1080);
    expect(features[features.length - 1].nextClose).toBe(1085);
  });

  it("captures a momentum close-to-next-open trade", () => {
    const { features, dates, regime } = scenario();
    const report = runResearch(
      features,
      dates,
      regime,
      { signal: "momentum", exit: "next_open", maxPositions: 1 },
      { costs: { buyFeePct: 0, sellFeePct: 0, slippagePct: 0 } }
    );
    expect(report.tradeCount).toBe(1);
    expect(report.trades[0].entry).toBe(1070);
    expect(report.trades[0].exit).toBe(1080);
    expect(report.totalReturnPct).toBeGreaterThan(0);
  });

  it("can exit at the next close and returns a matrix", () => {
    const { features, dates, regime } = scenario();
    const report = runResearch(
      features,
      dates,
      regime,
      { signal: "momentum", exit: "next_close", maxPositions: 1 },
      { costs: { buyFeePct: 0, sellFeePct: 0, slippagePct: 0 } }
    );
    expect(report.trades[0].exit).toBe(1085);
    expect(researchMatrix(features, dates, regime)).toHaveLength(16);
  });
});
