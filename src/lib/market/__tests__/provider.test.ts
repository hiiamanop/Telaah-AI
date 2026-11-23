import { describe, expect, it, vi } from "vitest";
import { OpenMarketProvider } from "../open-market";
import { getMarketProvider } from "../index";

const yahoo = {
  getCompanySnapshot: vi.fn().mockResolvedValue({
    overview: { company_name: "PT Bank Central Asia Tbk" },
    valuation: { current_pe: 12 },
  }),
  getQuarterlyFinancials: vi.fn().mockResolvedValue([]),
  getDailyTransactions: vi.fn().mockResolvedValue([]),
  getCorporateActions: vi.fn().mockResolvedValue([]),
  getCallLog: vi.fn().mockReturnValue([]),
};

describe("OpenMarketProvider", () => {
  it("exposes Yahoo capabilities and returns null for scraper-only modules", async () => {
    const provider = new OpenMarketProvider({ yahoo: yahoo as any });

    expect(provider.capabilities.has("dailyOHLCV")).toBe(true);
    expect(provider.capabilities.has("brokerSummary")).toBe(false);
    expect(await provider.getBrokerSummary("BBCA")).toBeNull();
    expect(await provider.getForeignFlow("BBCA")).toBeNull();
    expect(await provider.getFilings("BBCA")).toBeNull();
    expect((await provider.getInsiderFeed({})).unavailable).toBe(true);
  });

  it("fills the company name from the Yahoo snapshot", async () => {
    const provider = new OpenMarketProvider({ yahoo: yahoo as any });
    const report = await provider.getCompanyReport("BBCA");
    expect(report?.company_name).toBe("PT Bank Central Asia Tbk");
    expect(report?.symbol).toBe("BBCA");
  });
});

describe("getMarketProvider", () => {
  it("defaults to open", () => {
    delete process.env.MARKET_DATA_PROVIDER;
    expect(getMarketProvider().id).toBe("open-market");
  });
});
