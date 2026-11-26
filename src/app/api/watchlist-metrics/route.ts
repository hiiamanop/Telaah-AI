import { NextResponse } from "next/server";
import { getMarketMetrics, type MarketMetricItem } from "@/lib/screener/market-metrics";

const globalForMetrics = globalThis as typeof globalThis & {
  __telaahMetricsCache?: Map<string, { at: number; items: MarketMetricItem[] }>;
};

const cache =
  globalForMetrics.__telaahMetricsCache ??
  (globalForMetrics.__telaahMetricsCache = new Map());

export async function POST(req: Request) {
  try {
    const { symbols, includeFlow } = await req.json();
    if (!Array.isArray(symbols) || symbols.length === 0) {
      return NextResponse.json({ success: true, items: [] });
    }

    const key = `${symbols.map((symbol: string) => symbol.toUpperCase()).join(",")}|${includeFlow !== false}`;
    const cached = cache.get(key);
    if (cached && Date.now() - cached.at < 10 * 60_000) {
      return NextResponse.json({ success: true, items: cached.items, cached: true });
    }

    const items = await getMarketMetrics(symbols, {
      includeFlow: includeFlow !== false,
    });
    cache.set(key, { at: Date.now(), items });
    return NextResponse.json({ success: true, items, cached: false });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch watchlist metrics" },
      { status: 500 }
    );
  }
}
