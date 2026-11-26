import { NextRequest, NextResponse } from "next/server";
import { runHarmonicStats, type HarmonicStatsResult } from "@/lib/harmonic/outcomes";
import { RATE_LIMIT_RULES, guardRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const globalForStats = globalThis as typeof globalThis & {
  __telaahHarmonicStats?: { at: number; result: HarmonicStatsResult };
};

export async function GET(req: NextRequest) {
  const limited = await guardRateLimit(
    req,
    "harmonicStats",
    RATE_LIMIT_RULES.harmonicStats
  );
  if (limited) return limited;

  const refresh = new URL(req.url).searchParams.get("refresh") === "1";
  const cached = globalForStats.__telaahHarmonicStats;
  if (!refresh && cached && Date.now() - cached.at < 12 * 3600_000) {
    return NextResponse.json({ success: true, cached: true, ...cached.result });
  }
  try {
    const result = await runHarmonicStats();
    globalForStats.__telaahHarmonicStats = { at: Date.now(), result };
    return NextResponse.json({ success: true, cached: false, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Gagal menghitung statistik.",
      },
      { status: 500 }
    );
  }
}
