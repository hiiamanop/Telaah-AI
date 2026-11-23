import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/market", () => ({
  getMarketProvider: () => ({
    getInsiderFeed: async () => ({
      results: [],
      unavailable: true,
      stale: false,
      source: "none",
    }),
  }),
}));

vi.mock("@/lib/market/commodities", () => ({
  getCommodityPrices: async () => [
    {
      name: "Coal API2",
      code: "COAL",
      unit: "USD / Ton",
      latestPrice: 104.75,
      changePct: 1.2,
      history: [{ date: "2026-11-20", price: 104.75 }],
    },
  ],
}));

import { GET as getInsiderFeed } from "../insider-feed/route";
import { GET as getCommodityPrices } from "../commodity-prices/route";

describe("open-market API routes", () => {
  it("returns unavailable for the insider feed without a scraper", async () => {
    const response = await getInsiderFeed(
      new Request("http://localhost/api/insider-feed?limit=5") as any
    );
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.filings).toEqual([]);
    expect(body.unavailable).toBe(true);
  });

  it("returns Yahoo commodity benchmarks", async () => {
    const response = await getCommodityPrices();
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.commodities[0].code).toBe("COAL");
  });
});
