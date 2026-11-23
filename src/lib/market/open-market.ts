import fs from "fs";
import path from "path";
import type {
  BrokerRegistryItem,
  BrokerSummaryResponse,
  CompanyReport,
  CompanyReportSection,
  CorporateActionsResponse,
  DailyTransaction,
  FilingItem,
  ForeignFlowResponse,
  NewsItem,
  QuarterlyFinancialMetrics,
} from "@/lib/sectors/types";
import { fetchGoogleNews } from "./news";
import {
  InsiderFeedParams,
  InsiderFeedResult,
  MarketDataCapability,
  MarketDataProvider,
  CallLogEntry,
} from "./provider";
import { YahooClient } from "./yahoo";

const CAPABILITIES: MarketDataCapability[] = [
  "companyProfile",
  "valuation",
  "quarterlyFinancials",
  "dailyOHLCV",
  "peers",
  "news",
  "corporateActions",
];

export interface OpenMarketProviderOptions {
  yahoo?: YahooClient;
  news?: typeof fetchGoogleNews;
}

export class OpenMarketProvider implements MarketDataProvider {
  readonly id = "open-market" as const;
  readonly capabilities = new Set<MarketDataCapability>(CAPABILITIES);

  private readonly yahoo: YahooClient;
  private readonly news: typeof fetchGoogleNews;

  constructor(options: OpenMarketProviderOptions = {}) {
    this.yahoo = options.yahoo ?? new YahooClient();
    this.news = options.news ?? fetchGoogleNews;
  }

  async getBrokersRegistry(): Promise<BrokerRegistryItem[]> {
    try {
      const localPath = path.join(process.cwd(), "data", "brokers_registry.json");
      if (!fs.existsSync(localPath)) return [];
      const content = fs.readFileSync(localPath, "utf-8");
      return JSON.parse(content) as BrokerRegistryItem[];
    } catch {
      return [];
    }
  }

  async getCompanyReport(
    symbol: string,
    sections?: CompanyReportSection[]
  ): Promise<CompanyReport | null> {
    const clean = symbol.trim().toUpperCase().replace(".JK", "");
    const snapshot = await this.yahoo.getCompanySnapshot(clean, sections);
    if (!snapshot) return null;
    return {
      ...snapshot,
      symbol: snapshot.symbol || clean,
      company_name:
        snapshot.company_name || snapshot.overview?.company_name || clean,
    };
  }

  async getQuarterlyFinancials(
    symbol: string,
    nQuarters?: number
  ): Promise<QuarterlyFinancialMetrics[] | null> {
    return this.yahoo.getQuarterlyFinancials(symbol, nQuarters);
  }

  async getDailyTransactions(
    symbol: string,
    startDate?: string,
    endDate?: string
  ): Promise<DailyTransaction[] | null> {
    return this.yahoo.getDailyTransactions(symbol, startDate, endDate);
  }

  async getBrokerSummary(
    _symbol: string,
    _startDate?: string,
    _endDate?: string
  ): Promise<BrokerSummaryResponse | null> {
    return null;
  }

  async getForeignFlow(
    _symbol: string,
    _startDate?: string,
    _endDate?: string
  ): Promise<ForeignFlowResponse | null> {
    return null;
  }

  async getCorporateActions(
    symbol: string
  ): Promise<CorporateActionsResponse | null> {
    const actions = await this.yahoo.getCorporateActions(symbol);
    return {
      symbol: symbol.trim().toUpperCase().replace(".JK", ""),
      corporate_actions: actions,
    };
  }

  async getFilings(
    _symbol?: string,
    _params?: Record<string, unknown>
  ): Promise<{ results: FilingItem[] } | null> {
    return null;
  }

  async getInsiderFeed(_params?: InsiderFeedParams): Promise<InsiderFeedResult> {
    return {
      results: [],
      unavailable: true,
      limitations: ["Insider feed requires the Phase 2 scraper/Stockbit source."],
    };
  }

  async getNews(symbol: string, limit = 5): Promise<{ results: NewsItem[] }> {
    return { results: await this.news(symbol, limit) };
  }

  async getSuspensions(_symbol: string): Promise<{ results: any[] } | null> {
    return null;
  }

  async getCompanySegments(_symbol: string): Promise<any | null> {
    return null;
  }

  getCreditsUsed(): number {
    return 0;
  }

  getCallLog(): CallLogEntry[] {
    return this.yahoo.getCallLog();
  }
}
