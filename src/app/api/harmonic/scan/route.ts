import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { scanHarmonicUniverse } from "@/lib/screener/harmonic-screener";
import { RATE_LIMIT_RULES, guardRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const limited = await guardRateLimit(
    req,
    "harmonicScan",
    RATE_LIMIT_RULES.harmonicScan
  );
  if (limited) return limited;

  const { searchParams } = new URL(req.url);
  const refresh = searchParams.get("refresh") === "1";
  const rawDirection = searchParams.get("direction");
  const direction =
    rawDirection === "bearish" || rawDirection === "all"
      ? rawDirection
      : "bullish";
  const cachePath = path.join(
    process.cwd(),
    "data",
    direction === "bullish"
      ? "harmonic_cache.json"
      : `harmonic_cache_${direction}.json`
  );
  try {
    const result = await scanHarmonicUniverse({
      refresh,
      direction,
      cachePath,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Gagal memindai harmonic.",
      },
      { status: 500 }
    );
  }
}
