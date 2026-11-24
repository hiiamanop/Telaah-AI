import { NextResponse } from "next/server";
import { getMarketMetrics } from "@/lib/screener/market-metrics";

export async function POST(req: Request) {
  try {
    const { symbols } = await req.json();
    if (!Array.isArray(symbols) || symbols.length === 0) {
      return NextResponse.json({ success: true, items: [] });
    }

    const items = await getMarketMetrics(symbols);
    return NextResponse.json({ success: true, items });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch watchlist metrics" },
      { status: 500 }
    );
  }
}
