import { describe, expect, it, vi } from "vitest";
import { ScraperClient } from "../scraper-client";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("ScraperClient", () => {
  it("is inert when SCRAPER_URL is missing", async () => {
    const client = new ScraperClient({ baseUrl: "" });
    expect(client.isConfigured).toBe(false);
    expect(await client.getForeignFlow("BBCA")).toBeNull();
  });

  it("maps foreign flow and sends query parameters", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        symbol: "BBCA",
        data: [
          {
            date: "2026-11-23",
            net_foreign_inflow: 1_000_000,
            net_foreign_shares: 200,
            close: 5000,
          },
        ],
      })
    );
    const client = new ScraperClient({
      baseUrl: "http://scraper:8001",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    const result = await client.getForeignFlow("BBCA", 5);
    expect(result?.data[0].net_foreign_inflow).toBe(1_000_000);
    expect(fetchMock.mock.calls[0][0]).toContain("/v1/idx/foreign-flow/BBCA");
    expect(fetchMock.mock.calls[0][0]).toContain("length=5");
    expect(client.getCallLog()).toHaveLength(1);
  });

  it("maps insider filings and the market feed", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          results: [
            {
              title: "Laporan Kepemilikan",
              date: "2026-11-20",
              transaction_type: "buy",
              amount_transaction: 1000,
              source: "idx-announcement-pdf",
            },
          ],
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          results: [],
          source: "idx",
          limitations: [],
        })
      );
    const client = new ScraperClient({
      baseUrl: "http://scraper:8001",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    const filings = await client.getFilings("BBCA", 90, 10);
    expect(filings?.[0].transaction_type).toBe("buy");
    const feed = await client.getInsiderFeed({ days: 30, limit: 25 });
    expect(feed?.source).toBe("idx");
  });

  it("returns null instead of throwing when the scraper is down", async () => {
    const client = new ScraperClient({
      baseUrl: "http://scraper:8001",
      fetchImpl: vi.fn().mockResolvedValue(jsonResponse({ error: "down" }, 502)) as any,
    });
    expect(await client.getProfile("BBCA")).toBeNull();
    expect(await client.getBrokerSummary("BBCA")).toBeNull();
  });
});
