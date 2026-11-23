import type { DailyTransaction, QuarterlyFinancialMetrics } from "../sectors/types";
import { MarketDataError } from "./errors";
import { getUsdIdrRate as fetchUsdIdrRate } from "./fx";

const CHART_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";
const TIMESERIES_BASE =
  "https://query2.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries";
const DEFAULT_LOOKBACK_DAYS = 95;
const FINANCIALS_LOOKBACK_DAYS = 3 * 365;
const DEFAULT_FINANCIALS_QUARTERS = 4;
const MIN_FINANCIALS_PERIODS = 5;
const REQUEST_TIMEOUT_MS = 10_000;

const MONETARY_FINANCIAL_TYPES = [
  "quarterlyTotalRevenue",
  "quarterlyGrossProfit",
  "quarterlyOperatingIncome",
  "quarterlyNetIncome",
  "quarterlyEBITDA",
  "quarterlyTotalAssets",
  "quarterlyTotalLiabilities",
  "quarterlyStockholdersEquity",
  "quarterlyTotalDebt",
  "quarterlyCashAndCashEquivalents",
  "quarterlyOperatingCashFlow",
  "quarterlyFreeCashFlow",
] as const;

const FINANCIAL_TYPES = [
  ...MONETARY_FINANCIAL_TYPES,
  "quarterlyBasicEPS",
  "quarterlyOrdinarySharesNumber",
] as const;

export interface CallLogEntry {
  endpoint: string;
  params: Record<string, unknown>;
  credits: 0;
  provider: "yahoo";
  timestamp: string;
}

export interface YahooClientOptions {
  fetchImpl?: typeof fetch;
  now?: () => number;
  getUsdIdrRate?: () => Promise<number | null>;
  getQuarterlyFinancials?: (
    symbol: string,
    nQuarters?: number
  ) => Promise<QuarterlyFinancialMetrics[] | null>;
}

interface YahooSplit {
  timestamp: number;
  numerator: number;
  denominator: number;
}

interface ChartResult {
  meta?: { symbol?: string; currency?: string };
  timestamp?: number[];
  indicators?: {
    quote?: Array<{
      open?: Array<number | null>;
      high?: Array<number | null>;
      low?: Array<number | null>;
      close?: Array<number | null>;
      volume?: Array<number | null>;
    }>;
  };
  events?: { splits?: Record<string, { numerator?: number; denominator?: number }> };
}

interface TimeseriesEntry {
  asOfDate?: string;
  periodType?: string;
  currencyCode?: string;
  reportedValue?: { raw?: unknown };
}

interface TimeseriesResultItem {
  meta?: { type?: string[] };
  [key: string]: unknown;
}

interface FinancialPeriodDraft {
  date: string;
  currency: string | null;
  values: Map<string, number>;
}

export function toYahooSymbol(symbol: string): string {
  const clean = symbol.trim().toUpperCase();
  if (!clean || clean.startsWith("^")) return clean;
  return clean.endsWith(".JK") ? clean : `${clean}.JK`;
}

const JAKARTA_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function jakartaDate(unixSeconds: number): string {
  return JAKARTA_DATE.format(new Date(unixSeconds * 1000));
}

function parseDateArg(value: string, endOfDay: boolean): number {
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T${endOfDay ? "23:59:59" : "00:00:00"}Z`
    : value;
  const ms = Date.parse(normalized);
  if (!Number.isFinite(ms)) {
    throw new MarketDataError(`Tanggal tidak valid: "${value}"`, "yahoo", "config");
  }
  return Math.floor(ms / 1000);
}

function toFiniteNumber(value: unknown): number | null {
  const num = typeof value === "string" ? Number(value) : value;
  return typeof num === "number" && Number.isFinite(num) ? num : null;
}

function parseSplits(result: ChartResult): YahooSplit[] {
  const raw = result.events?.splits;
  if (!raw) return [];
  return Object.entries(raw)
    .map(([key, split]) => ({
      timestamp: Number(key),
      numerator: toFiniteNumber(split?.numerator) ?? 0,
      denominator: toFiniteNumber(split?.denominator) ?? 0,
    }))
    .filter(
      (split) =>
        Number.isFinite(split.timestamp) &&
        split.numerator > 0 &&
        split.denominator > 0
    )
    .sort((a, b) => a.timestamp - b.timestamp);
}

function groupFinancialPeriods(results: TimeseriesResultItem[]): FinancialPeriodDraft[] {
  const byDate = new Map<string, FinancialPeriodDraft>();

  for (const item of results) {
    const type = item?.meta?.type?.[0];
    if (!type) continue;
    const entries = item[type];
    if (!Array.isArray(entries)) continue;

    for (const entry of entries as TimeseriesEntry[]) {
      if (!entry || entry.periodType !== "3M") continue;
      const date = typeof entry.asOfDate === "string" ? entry.asOfDate : null;
      const raw = toFiniteNumber(entry.reportedValue?.raw);
      if (!date || raw === null) continue;

      let period = byDate.get(date);
      if (!period) {
        period = { date, currency: null, values: new Map() };
        byDate.set(date, period);
      }
      if (period.currency === null && typeof entry.currencyCode === "string" && entry.currencyCode) {
        period.currency = entry.currencyCode.toUpperCase();
      }
      period.values.set(type, raw);
    }
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export class YahooClient {
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;
  private readonly usdIdrRate: () => Promise<number | null>;
  private readonly financialsOverride?: YahooClientOptions["getQuarterlyFinancials"];
  private readonly callLog: CallLogEntry[] = [];

  constructor(options: YahooClientOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? Date.now;
    this.usdIdrRate = options.getUsdIdrRate ?? (() => fetchUsdIdrRate(this.fetchImpl));
    this.financialsOverride = options.getQuarterlyFinancials;
  }

  public getCallLog(): CallLogEntry[] {
    return [...this.callLog];
  }

  /**
   * Daily OHLCV, split-adjusted so bars before a split line up with bars after
   * it. Yahoo returns splits as events keyed by the split's unix timestamp.
   */
  public async getDailyTransactions(
    symbol: string,
    startDate?: string,
    endDate?: string
  ): Promise<DailyTransaction[]> {
    const yahooSymbol = toYahooSymbol(symbol);
    if (!yahooSymbol) {
      throw new MarketDataError("Simbol emiten kosong.", "yahoo", "config");
    }
    const idSymbol = yahooSymbol.startsWith("^")
      ? yahooSymbol
      : yahooSymbol.replace(/\.JK$/, "");

    const nowSeconds = Math.floor(this.now() / 1000);
    const period1 =
      startDate !== undefined
        ? parseDateArg(startDate, false)
        : nowSeconds - DEFAULT_LOOKBACK_DAYS * 24 * 60 * 60;
    const period2 =
      endDate !== undefined ? parseDateArg(endDate, true) : nowSeconds;

    const params = {
      period1: String(period1),
      period2: String(period2),
      interval: "1d",
      events: "split",
    };
    const endpoint = `/v8/finance/chart/${yahooSymbol}`;
    const url = `${CHART_BASE}/${encodeURIComponent(yahooSymbol)}?${new URLSearchParams(params).toString()}`;

    let res: Response;
    try {
      res = await this.fetchImpl(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    } catch (error) {
      throw new MarketDataError(
        `Yahoo chart request gagal untuk ${yahooSymbol}: ${(error as Error)?.message ?? "unknown"}`,
        "yahoo",
        "network"
      );
    }

    if (!res.ok) {
      const kind = res.status === 404 ? "not_found" : "provider";
      throw new MarketDataError(
        `Yahoo chart error [${res.status}] untuk ${yahooSymbol}.`,
        "yahoo",
        kind
      );
    }

    this.callLog.push({
      endpoint,
      params: { symbol: yahooSymbol, ...params },
      credits: 0,
      provider: "yahoo",
      timestamp: new Date(this.now()).toISOString(),
    });

    let body: { chart?: { result?: ChartResult[] | null; error?: { code?: string; description?: string } } };
    try {
      body = await res.json();
    } catch {
      throw new MarketDataError(
        `Yahoo chart mengembalikan JSON tidak valid untuk ${yahooSymbol}.`,
        "yahoo",
        "provider"
      );
    }

    const result = body?.chart?.result?.[0];
    if (!result) {
      const code = body?.chart?.error?.code;
      throw new MarketDataError(
        `Yahoo chart tidak menemukan data untuk ${yahooSymbol}${code ? ` (${code})` : ""}.`,
        "yahoo",
        "not_found"
      );
    }

    const timestamps = result.timestamp ?? [];
    const quote = result.indicators?.quote?.[0];
    if (timestamps.length === 0) return [];
    if (!quote) {
      throw new MarketDataError(
        `Yahoo chart tidak menyertakan data OHLCV untuk ${yahooSymbol}.`,
        "yahoo",
        "provider"
      );
    }

    const splits = parseSplits(result);
    const rows: DailyTransaction[] = [];

    for (let i = 0; i < timestamps.length; i += 1) {
      const timestamp = timestamps[i];
      if (!Number.isFinite(timestamp)) continue;

      const close = toFiniteNumber(quote.close?.[i]);
      const volume = toFiniteNumber(quote.volume?.[i]);
      const open = toFiniteNumber(quote.open?.[i]);
      const high = toFiniteNumber(quote.high?.[i]);
      const low = toFiniteNumber(quote.low?.[i]);
      if (close === null || volume === null || open === null || high === null || low === null) {
        continue;
      }

      let priceFactor = 1;
      let volumeFactor = 1;
      for (const split of splits) {
        if (timestamp < split.timestamp) {
          priceFactor *= split.denominator / split.numerator;
          volumeFactor *= split.numerator / split.denominator;
        }
      }

      rows.push({
        symbol: idSymbol,
        date: jakartaDate(timestamp),
        open: open * priceFactor,
        high: high * priceFactor,
        low: low * priceFactor,
        close: close * priceFactor,
        volume: Math.round(volume * volumeFactor),
      });
    }

    return rows.sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Quarterly statements normalized to IDR. IDX issuers may report in USD
   * (e.g. ADRO), so monetary values are converted with the USD/IDR rate while
   * share counts stay untouched. Returns null when a conversion is needed but
   * no rate is available, rather than mixing currencies.
   */
  public async getQuarterlyFinancials(
    symbol: string,
    nQuarters: number = DEFAULT_FINANCIALS_QUARTERS
  ): Promise<QuarterlyFinancialMetrics[] | null> {
    if (this.financialsOverride) {
      return this.financialsOverride(symbol, nQuarters);
    }

    const yahooSymbol = toYahooSymbol(symbol);
    if (!yahooSymbol) {
      throw new MarketDataError("Simbol emiten kosong.", "yahoo", "config");
    }
    const idSymbol = yahooSymbol.startsWith("^")
      ? yahooSymbol
      : yahooSymbol.replace(/\.JK$/, "");

    const nowSeconds = Math.floor(this.now() / 1000);
    const period1 = nowSeconds - FINANCIALS_LOOKBACK_DAYS * 24 * 60 * 60;
    const params = {
      symbol: yahooSymbol,
      type: FINANCIAL_TYPES.join(","),
      period1: String(period1),
      period2: String(nowSeconds),
    };
    const endpoint = `/ws/fundamentals-timeseries/v1/finance/timeseries/${yahooSymbol}`;
    const url = `${TIMESERIES_BASE}/${encodeURIComponent(yahooSymbol)}?${new URLSearchParams(params).toString()}`;

    let res: Response;
    try {
      res = await this.fetchImpl(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    } catch (error) {
      throw new MarketDataError(
        `Yahoo fundamentals request gagal untuk ${yahooSymbol}: ${(error as Error)?.message ?? "unknown"}`,
        "yahoo",
        "network"
      );
    }

    if (!res.ok) {
      const kind = res.status === 404 ? "not_found" : "provider";
      throw new MarketDataError(
        `Yahoo fundamentals error [${res.status}] untuk ${yahooSymbol}.`,
        "yahoo",
        kind
      );
    }

    this.callLog.push({
      endpoint,
      params,
      credits: 0,
      provider: "yahoo",
      timestamp: new Date(this.now()).toISOString(),
    });

    let body: {
      timeseries?: {
        result?: TimeseriesResultItem[] | null;
        error?: { code?: string; description?: string } | null;
      };
    };
    try {
      body = await res.json();
    } catch {
      throw new MarketDataError(
        `Yahoo fundamentals mengembalikan JSON tidak valid untuk ${yahooSymbol}.`,
        "yahoo",
        "provider"
      );
    }

    const results = body?.timeseries?.result;
    if (!results) {
      const code = body?.timeseries?.error?.code;
      if (code) {
        throw new MarketDataError(
          `Yahoo fundamentals tidak menemukan data untuk ${yahooSymbol} (${code}).`,
          "yahoo",
          "not_found"
        );
      }
      return [];
    }

    const periods = groupFinancialPeriods(results).filter((period) =>
      MONETARY_FINANCIAL_TYPES.some((type) => period.values.has(type))
    );
    if (periods.length === 0) return [];

    const wanted = Number.isFinite(nQuarters) && nQuarters > 0
      ? Math.floor(nQuarters)
      : DEFAULT_FINANCIALS_QUARTERS;
    const selected = periods.slice(-Math.max(wanted + 1, MIN_FINANCIALS_PERIODS));

    if (selected.some((period) => period.currency === null)) return null;
    const foreignCurrencies = [
      ...new Set(
        selected
          .map((period) => period.currency as string)
          .filter((currency) => currency !== "IDR")
      ),
    ];
    let usdIdrRate: number | null = null;
    if (foreignCurrencies.length > 0) {
      // Only USD/IDR is available; converting any other currency with it would
      // silently misstate the numbers.
      if (foreignCurrencies.some((currency) => currency !== "USD")) return null;
      usdIdrRate = await this.usdIdrRate();
      if (usdIdrRate === null || !Number.isFinite(usdIdrRate) || usdIdrRate <= 0) {
        return null;
      }
    }

    return selected.map((period) => {
      const sourceCurrency = period.currency as string;
      const fxRate = sourceCurrency === "IDR" ? 1 : (usdIdrRate as number);
      const toIdr = (type: string): number | undefined => {
        const value = period.values.get(type);
        return value === undefined ? undefined : value * fxRate;
      };

      const shares = period.values.get("quarterlyOrdinarySharesNumber");
      const basicEps = period.values.get("quarterlyBasicEPS");
      const sectorMetrics: Record<string, number> = {};
      if (shares !== undefined) sectorMetrics.ordinary_shares = shares;
      if (basicEps !== undefined) sectorMetrics.basic_eps = basicEps * fxRate;

      return {
        symbol: idSymbol,
        date: period.date,
        currency: "IDR",
        sourceCurrency,
        fxRate,
        revenue: toIdr("quarterlyTotalRevenue"),
        gross_profit: toIdr("quarterlyGrossProfit"),
        operating_pnl: toIdr("quarterlyOperatingIncome"),
        earnings: toIdr("quarterlyNetIncome"),
        ebitda: toIdr("quarterlyEBITDA"),
        total_assets: toIdr("quarterlyTotalAssets"),
        total_liabilities: toIdr("quarterlyTotalLiabilities"),
        total_equity: toIdr("quarterlyStockholdersEquity"),
        total_debt: toIdr("quarterlyTotalDebt"),
        cash_and_short_term_investments: toIdr("quarterlyCashAndCashEquivalents"),
        operating_cash_flow: toIdr("quarterlyOperatingCashFlow"),
        free_cash_flow: toIdr("quarterlyFreeCashFlow"),
        financials_sector_metrics:
          Object.keys(sectorMetrics).length > 0 ? sectorMetrics : undefined,
      };
    });
  }
}
