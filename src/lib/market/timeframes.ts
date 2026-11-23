import type { HarmonicCandle, HarmonicTimeframe } from "@/lib/quant/harmonic";
import type { DailyTransaction } from "@/lib/sectors/types";

function toCandle(row: DailyTransaction): HarmonicCandle {
  return {
    date: row.date,
    open: row.open,
    high: row.high,
    low: row.low,
    close: row.close,
    volume: row.volume,
  };
}

function aggregateByKey(
  rows: DailyTransaction[],
  keyFor: (row: DailyTransaction) => string
): HarmonicCandle[] {
  const groups = new Map<string, HarmonicCandle>();

  for (const row of rows) {
    const key = keyFor(row);
    const current = groups.get(key);
    if (!current) {
      groups.set(key, toCandle(row));
      continue;
    }
    current.high = Math.max(current.high, row.high);
    current.low = Math.min(current.low, row.low);
    current.close = row.close;
    current.volume += row.volume;
    current.date = row.date;
  }

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, candle]) => candle);
}

function weeklyKey(date: string): string {
  const day = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  const offset = (day.getUTCDay() + 6) % 7;
  day.setUTCDate(day.getUTCDate() - offset);
  return day.toISOString().slice(0, 10);
}

export function aggregateToWeekly(rows: DailyTransaction[]): HarmonicCandle[] {
  return aggregateByKey(rows, (row) => weeklyKey(row.date));
}

export function aggregateToMonthly(rows: DailyTransaction[]): HarmonicCandle[] {
  return aggregateByKey(rows, (row) => row.date.slice(0, 7));
}

const JAKARTA_PARTS = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hour12: false,
});

function jakartaSessionKey(date: string): string {
  const parts = JAKARTA_PARTS.formatToParts(new Date(date));
  const pick = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const day = `${pick("year")}-${pick("month")}-${pick("day")}`;
  const hour = Number(pick("hour"));
  return `${day}-${hour < 12 ? "AM" : "PM"}`;
}

/**
 * Yahoo returns 1-hour bars. IDX has a midday break, so grouping by Jakarta
 * calendar date plus morning/afternoon gives two usable 4H session candles
 * per trading day instead of a misleading rolling window.
 */
export function aggregateToFourHour(rows: DailyTransaction[]): HarmonicCandle[] {
  return aggregateByKey(rows, (row) => jakartaSessionKey(row.date));
}

export function buildTimeframeCandles(
  rows: DailyTransaction[],
  timeframe: HarmonicTimeframe
): HarmonicCandle[] {
  if (timeframe === "4H") return aggregateToFourHour(rows);
  if (timeframe === "1W") return aggregateToWeekly(rows);
  if (timeframe === "1M") return aggregateToMonthly(rows);
  return rows.map(toCandle);
}
