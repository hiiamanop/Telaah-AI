import { describe, expect, it } from "vitest";
import type { DailyTransaction } from "@/lib/sectors/types";
import {
  aggregateToFourHour,
  aggregateToMonthly,
  aggregateToWeekly,
  buildTimeframeCandles,
} from "../timeframes";

function row(
  date: string,
  open: number,
  high: number,
  low: number,
  close: number,
  volume: number
): DailyTransaction {
  return { symbol: "TEST", date, open, high, low, close, volume };
}

describe("aggregateToWeekly", () => {
  it("groups Monday-to-Friday candles into one OHLCV bar", () => {
    const weekly = aggregateToWeekly([
      row("2026-01-01", 100, 110, 95, 105, 10),
      row("2026-01-02", 105, 115, 100, 112, 20),
      row("2026-01-05", 112, 118, 108, 116, 30),
    ]);
    expect(weekly).toHaveLength(2);
    expect(weekly[0]).toEqual({
      date: "2026-01-02",
      open: 100,
      high: 115,
      low: 95,
      close: 112,
      volume: 30,
    });
    expect(weekly[1].open).toBe(112);
    expect(weekly[1].close).toBe(116);
  });
});

describe("aggregateToMonthly", () => {
  it("groups by calendar month", () => {
    const monthly = aggregateToMonthly([
      row("2026-01-02", 100, 110, 95, 105, 10),
      row("2026-01-30", 105, 120, 101, 118, 20),
      row("2026-02-02", 118, 125, 115, 122, 30),
    ]);
    expect(monthly).toHaveLength(2);
    expect(monthly[0]).toEqual({
      date: "2026-01-30",
      open: 100,
      high: 120,
      low: 95,
      close: 118,
      volume: 30,
    });
  });
});

describe("aggregateToFourHour", () => {
  it("splits a Jakarta trading day into morning and afternoon sessions", () => {
    const rows = [
      row("2026-01-05T03:00:00.000Z", 100, 102, 99, 101, 10), // 10:00 WIB
      row("2026-01-05T04:00:00.000Z", 101, 103, 100, 102, 20), // 11:00 WIB
      row("2026-01-05T06:00:00.000Z", 102, 104, 101, 103, 30), // 13:00 WIB
      row("2026-01-05T07:00:00.000Z", 103, 105, 102, 104, 40), // 14:00 WIB
      row("2026-01-06T03:00:00.000Z", 104, 106, 103, 105, 50),
    ];
    const fourHour = aggregateToFourHour(rows);
    expect(fourHour).toHaveLength(3);
    expect(fourHour[0]).toEqual({
      date: "2026-01-05T04:00:00.000Z",
      open: 100,
      high: 103,
      low: 99,
      close: 102,
      volume: 30,
    });
    expect(fourHour[1]).toEqual({
      date: "2026-01-05T07:00:00.000Z",
      open: 102,
      high: 105,
      low: 101,
      close: 104,
      volume: 70,
    });
    expect(fourHour[2].date).toBe("2026-01-06T03:00:00.000Z");
  });
});

describe("buildTimeframeCandles", () => {
  it("maps daily rows without aggregation", () => {
    const candles = buildTimeframeCandles(
      [row("2026-01-06", 100, 110, 95, 105, 10)],
      "1D"
    );
    expect(candles[0]).toEqual({
      date: "2026-01-06",
      open: 100,
      high: 110,
      low: 95,
      close: 105,
      volume: 10,
    });
  });
});
