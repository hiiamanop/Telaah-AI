import crypto from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import companiesData from "@/data/idx-companies.json";
import { getMarketMetrics, type MarketMetricItem } from "@/lib/screener/market-metrics";
import { cacheGet, cacheSet } from "@/lib/storage/json-cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const UNIVERSE = companiesData as Array<{ symbol: string; name: string }>;
const CACHE_KEY = "screener:full:snapshot:v1";
const FILE_PATH = path.join(process.cwd(), "data", "screener_full.json");

interface FullSnapshot {
  generatedAt: string;
  complete: boolean;
  cursor: number;
  total: number;
  items: MarketMetricItem[];
}

function secretMatches(received: string | null, expected: string): boolean {
  if (!received) return false;
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

async function readSnapshot(): Promise<FullSnapshot | null> {
  const cached = await cacheGet<FullSnapshot>(CACHE_KEY);
  if (cached) return cached;
  try {
    return JSON.parse(await readFile(FILE_PATH, "utf8")) as FullSnapshot;
  } catch {
    return null;
  }
}

export async function GET() {
  const snapshot = await readSnapshot();
  return NextResponse.json({
    success: true,
    items: snapshot?.items ?? [],
    generatedAt: snapshot?.generatedAt ?? null,
    complete: snapshot?.complete ?? false,
    cursor: snapshot?.cursor ?? 0,
    total: snapshot?.total ?? UNIVERSE.length,
  });
}

export async function POST(req: NextRequest) {
  const expected = process.env.ALERT_SECRET?.trim();
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: "ALERT_SECRET belum diatur." },
      { status: 503 }
    );
  }
  if (!secretMatches(req.headers.get("x-alert-secret"), expected)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const cursor = Math.max(0, Math.min(Number(body.cursor) || 0, UNIVERSE.length));
  const batchSize = Math.max(1, Math.min(Number(body.batchSize) || 40, 80));
  const batch = UNIVERSE.slice(cursor, cursor + batchSize);
  const metrics = await getMarketMetrics(
    batch.map((item) => item.symbol),
    { includeFlow: false, includeFundamentals: false }
  );

  const previous = cursor === 0 ? null : await readSnapshot();
  const bySymbol = new Map<string, MarketMetricItem>();
  for (const item of previous?.items ?? []) bySymbol.set(item.symbol, item);
  for (const item of metrics) bySymbol.set(item.symbol, item);
  const nextCursor = cursor + batch.length;
  const done = nextCursor >= UNIVERSE.length;
  const snapshot: FullSnapshot = {
    generatedAt: done
      ? new Date().toISOString()
      : previous?.generatedAt ?? new Date().toISOString(),
    complete: done,
    cursor: done ? 0 : nextCursor,
    total: UNIVERSE.length,
    items: [...bySymbol.values()],
  };

  await cacheSet(CACHE_KEY, snapshot, 24 * 3600);
  try {
    await mkdir(path.dirname(FILE_PATH), { recursive: true });
    await writeFile(FILE_PATH, JSON.stringify(snapshot), "utf8");
  } catch {
    // Redis remains the primary cache.
  }

  return NextResponse.json({
    ok: true,
    batch: metrics.length,
    totalItems: snapshot.items.length,
    nextCursor,
    done,
    complete: snapshot.complete,
    total: UNIVERSE.length,
  });
}
