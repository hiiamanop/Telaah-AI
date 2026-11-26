import { describe, expect, it } from "vitest";
import {
  aggregateOutcomes,
  measurePatternOutcome,
  type HistoricalPattern,
} from "../outcomes";
import type { HarmonicCandle } from "@/lib/quant/harmonic";

function candle(index: number, high: number, low: number, close = low): HarmonicCandle {
  return {
    date: new Date(Date.UTC(2026, 0, 1 + index)).toISOString().slice(0, 10),
    open: close,
    high,
    low,
    close,
    volume: 1000,
  };
}

const pattern: HistoricalPattern = {
  symbol: "TEST",
  timeframe: "1D",
  pattern: "Gartley",
  direction: "bullish",
  dIndex: 4,
  dDate: "2026-01-05",
  prz: { low: 98, high: 102 },
  invalidation: 95,
  targets: { t1: 110, t2: 120 },
};

function baseCandles(): HarmonicCandle[] {
  return [
    candle(0, 120, 110),
    candle(1, 115, 100),
    candle(2, 118, 105),
    candle(3, 116, 100),
    candle(4, 101, 99),
    candle(5, 111, 99),
    candle(6, 121, 105),
  ];
}

describe("harmonic outcomes", () => {
  it("records T1 and T2 hits", () => {
    const outcome = measurePatternOutcome(pattern, baseCandles());
    expect(outcome.status).toBe("t2");
    expect(outcome.daysToT1).toBe(1);
    expect(outcome.daysToT2).toBe(2);
  });

  it("records invalidation before any target", () => {
    const candles = baseCandles();
    candles[5] = candle(5, 100, 94);
    const outcome = measurePatternOutcome(pattern, candles);
    expect(outcome.status).toBe("invalidated");
    expect(outcome.daysToT1).toBeNull();
  });

  it("aggregates hit rates and average days", () => {
    const t1 = measurePatternOutcome(pattern, [
      ...baseCandles().slice(0, 5),
      candle(5, 111, 99),
    ]);
    const invalid = measurePatternOutcome(pattern, [
      ...baseCandles().slice(0, 5),
      candle(5, 100, 94),
    ]);
    const stats = aggregateOutcomes([
      { pattern, outcome: t1 },
      { pattern, outcome: invalid },
    ]);
    expect(stats).toHaveLength(1);
    expect(stats[0].total).toBe(2);
    expect(stats[0].t1Hits).toBe(1);
    expect(stats[0].invalidated).toBe(1);
    expect(stats[0].t1RatePct).toBe(50);
  });
});
