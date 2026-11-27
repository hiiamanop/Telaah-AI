import { getMarketProvider } from "@/lib/market";
import { extractValuationMultiples } from "@/lib/sectors/types";
import { computeTechnicalIndicators } from "@/lib/quant/indicators";
import { getCompanyName } from "@/lib/sectors/companies";
import { cacheGet, cacheSet } from "@/lib/storage/json-cache";

export interface MarketMetricItem {
  symbol: string;
  name: string;
  sector: string;
  subSector: string;
  marketCap: number;
  lastPrice: number;
  dailyChangePct: number;
  pe: number | null;
  pb: number | null;
  rsi: number | null;
  trend: string;
  flow5d: number | null;
}

export interface MarketMetricsOptions {
  includeFlow?: boolean;
  includeFundamentals?: boolean;
}

export async function getMarketMetrics(
  symbols: string[],
  options: MarketMetricsOptions = {}
): Promise<MarketMetricItem[]> {
  if (!Array.isArray(symbols) || symbols.length === 0) return [];

  const targetSymbols = symbols
    .slice(0, 120)
    .map((symbol) => symbol.toUpperCase().trim());
  const client = getMarketProvider();
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  return mapLimit(targetSymbols, 6, async (symbol) => {
    const cacheKey = `metric:${symbol}:${options.includeFlow === false ? "noflow" : "flow"}:${options.includeFundamentals === false ? "light" : "full"}:v1`;
    const cachedItem = await cacheGet<MarketMetricItem>(cacheKey);
    if (cachedItem) return cachedItem;
    try {
        const includeFundamentals = options.includeFundamentals !== false;
        const [reportData, dailyData, flowData] = await Promise.all([
          includeFundamentals
            ? client
                .getCompanyReport(symbol, ["overview", "valuation"])
                .catch(() => null)
            : Promise.resolve(null),
          client.getDailyTransactions(symbol, ninetyDaysAgo).catch(() => null),
          options.includeFlow === false
            ? Promise.resolve(null)
            : client.getForeignFlow(symbol).catch(() => null),
        ]);

        const multiples = extractValuationMultiples(reportData?.valuation);
        const tech =
          dailyData && dailyData.length > 0
            ? computeTechnicalIndicators(dailyData)
            : null;

        const lastPrice =
          tech?.lastPrice || multiples.lastClosePrice || 0;
        const dailyChangePct =
          tech?.dailyReturnPct ??
          (multiples.dailyChange ? multiples.dailyChange * 100 : 0);

        let flow5d: number | null = null;
        const flowItems = Array.isArray(flowData)
          ? flowData
          : Array.isArray((flowData as any)?.data)
            ? (flowData as any).data
            : [];
        if (flowItems.length > 0) {
          flow5d = flowItems
            .slice(-5)
            .reduce(
              (sum: number, row: any) => sum + (row.net_foreign_inflow || 0),
              0
            );
        }

        const item: MarketMetricItem = {
          symbol,
          name:
            reportData?.company_name ||
            getCompanyName(symbol) ||
            `PT ${symbol} Tbk`,
          sector: reportData?.overview?.sector || "Umum",
          subSector: reportData?.overview?.sub_sector || "",
          marketCap: reportData?.overview?.market_cap || 0,
          lastPrice,
          dailyChangePct,
          pe: multiples.pe ?? null,
          pb: multiples.pb ?? null,
          rsi: tech?.rsi14 ?? null,
          trend: tech?.trendAssessment || "Neutral",
          flow5d,
        };
        await cacheSet(cacheKey, item, 10 * 60);
        return item;
      } catch {
        return {
          symbol,
          name: getCompanyName(symbol) || `PT ${symbol} Tbk`,
          sector: "Umum",
          subSector: "",
          marketCap: 0,
          lastPrice: 0,
          dailyChangePct: 0,
          pe: null,
          pb: null,
          rsi: null,
          trend: "Neutral",
          flow5d: null,
        };
      }
    });
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (true) {
        const index = cursor;
        cursor += 1;
        if (index >= items.length) return;
        results[index] = await worker(items[index]);
      }
    })
  );
  return results;
}
