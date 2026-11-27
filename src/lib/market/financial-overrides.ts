import fs from "node:fs";
import path from "node:path";
import type { FundamentalUpdate } from "@/lib/agent/types";

const OVERRIDES_PATH = path.join(
  process.cwd(),
  "data",
  "financial_overrides.json"
);

let cached: {
  mtimeMs: number;
  data: Record<string, FundamentalUpdate>;
} | null = null;

/**
 * Latest-period note maintained when a filing is out but the market data
 * provider has not ingested it yet. Missing or invalid files return null.
 */
export function getFundamentalUpdate(
  symbol: string
): FundamentalUpdate | null {
  const clean = symbol.trim().toUpperCase().replace(".JK", "");
  try {
    const stat = fs.statSync(OVERRIDES_PATH);
    if (!cached || cached.mtimeMs !== stat.mtimeMs) {
      const parsed = JSON.parse(fs.readFileSync(OVERRIDES_PATH, "utf8"));
      cached = {
        mtimeMs: stat.mtimeMs,
        data:
          parsed && typeof parsed === "object" && !Array.isArray(parsed)
            ? (parsed as Record<string, FundamentalUpdate>)
            : {},
      };
    }
    return cached.data[clean] ?? null;
  } catch {
    return null;
  }
}
