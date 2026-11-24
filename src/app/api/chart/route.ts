import { NextRequest, NextResponse } from "next/server";
import {
  ScraperClient,
  type ChartCandle,
} from "@/lib/market/scraper-client";
import { YahooClient } from "@/lib/market/yahoo";

export const dynamic = "force-dynamic";

type ChartTimeframe = "1D" | "1W" | "1Y" | "5Y";

function normalizeTimeframe(value: string | null): ChartTimeframe {
  if (value === "1D" || value === "1W" || value === "1Y" || value === "5Y") {
    return value;
  }
  return "1Y";
}

function toTimestamp(date: string): number {
  const value = date.includes("T")
    ? date
    : `${date}T00:00:00+07:00`;
  return Math.floor(new Date(value).getTime() / 1000);
}

async function yahooFallback(
  symbol: string,
  timeframe: ChartTimeframe
): Promise<ChartCandle[]> {
  const yahoo = new YahooClient();
  const rows =
    timeframe === "1D" || timeframe === "1W"
      ? await yahoo.getHourlyTransactions(symbol)
      : await yahoo.getDailyTransactions(
          symbol,
          new Date(Date.now() - 5 * 365 * 86_400_000).toISOString().slice(0, 10)
        );

  const candles = rows
    .map((row) => ({
      time: toTimestamp(row.date),
      date: new Date(toTimestamp(row.date) * 1000)
        .toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" }),
      open: row.open,
      high: row.high,
      low: row.low,
      close: row.close,
      volume: row.volume,
    }))
    .filter((candle) => Number.isFinite(candle.time));

  candles.sort((left, right) => left.time - right.time);
  const unique = [...new Map(candles.map((c) => [c.time, c])).values()];

  if (timeframe === "1D" && unique.length > 0) {
    const latestDate = new Date(unique[unique.length - 1].time * 1000)
      .toISOString()
      .slice(0, 10);
    const latest = unique.filter(
      (candle) =>
        new Date(candle.time * 1000).toISOString().slice(0, 10) === latestDate
    );
    return latest.length > 0 ? latest : unique.slice(-24);
  }
  if (timeframe === "1W") {
    return unique.slice(-7 * 8);
  }
  if (timeframe === "1Y") {
    return unique.slice(-260);
  }
  return unique;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get("symbol") || "BBCA")
    .trim()
    .toUpperCase()
    .replace(".JK", "");
  const timeframe = normalizeTimeframe(searchParams.get("timeframe"));

  if (!/^[A-Z]{4}$/.test(symbol)) {
    return NextResponse.json(
      { success: false, error: "Kode emiten harus 4 huruf." },
      { status: 400 }
    );
  }

  try {
    const scraper = new ScraperClient();
    const stockbit = await scraper.getChart(symbol, timeframe).catch(() => null);
    if (stockbit?.candles.length) {
      return NextResponse.json({
        success: true,
        symbol,
        timeframe,
        source: "stockbit",
        delayed: false,
        candles: stockbit.candles,
        last: stockbit.candles[stockbit.candles.length - 1],
      });
    }

    const candles = await yahooFallback(symbol, timeframe);
    if (candles.length === 0) {
      return NextResponse.json(
        { success: false, error: `Data chart ${symbol} tidak tersedia.` },
        { status: 503 }
      );
    }
    return NextResponse.json({
      success: true,
      symbol,
      timeframe,
      source: "yahoo",
      delayed: true,
      candles,
      last: candles[candles.length - 1],
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Gagal memuat data chart.",
      },
      { status: 500 }
    );
  }
}
