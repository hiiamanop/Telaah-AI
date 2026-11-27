import { NextRequest, NextResponse } from "next/server";
import { fetchGoogleNews } from "@/lib/market/news";
import { guardRateLimit, RATE_LIMIT_RULES } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const limited = await guardRateLimit(req, "chart", RATE_LIMIT_RULES.chart);
  if (limited) return limited;

  const { searchParams } = new URL(req.url);
  const raw = (searchParams.get("symbol") ?? "IHSG")
    .trim()
    .toUpperCase()
    .replace(".JK", "");
  const symbol = /^[A-Z]{4}$/.test(raw) ? raw : "IHSG";
  const limit = Math.max(1, Math.min(Number(searchParams.get("limit")) || 20, 30));

  const items = await fetchGoogleNews(symbol, limit).catch(() => []);
  return NextResponse.json({
    success: true,
    symbol,
    items,
    source: "Google News RSS",
    delayed: true,
  });
}
