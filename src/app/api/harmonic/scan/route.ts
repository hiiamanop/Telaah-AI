import { NextRequest, NextResponse } from "next/server";
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

  const refresh = new URL(req.url).searchParams.get("refresh") === "1";
  try {
    const result = await scanHarmonicUniverse({ refresh });
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
