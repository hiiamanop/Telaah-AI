import { describe, expect, it, vi } from "vitest";
import { extractNewsImage, fetchGoogleNews } from "../news";

const rss = `<?xml version="1.0"?><rss><channel>
<item><title>BBCA naik - Kontan</title><link>https://example.com/a</link><pubDate>Mon, 23 Nov 2026 08:00:00 GMT</pubDate><source url="https://kontan.co.id">Kontan</source></item>
<item><title>BBCA turun - Bisnis</title><link>https://example.com/b</link><pubDate>Mon, 23 Nov 2026 09:00:00 GMT</pubDate><source url="https://bisnis.com">Bisnis</source></item>
</channel></rss>`;

describe("extractNewsImage", () => {
  it("reads og:image in either meta attribute order", () => {
    expect(
      extractNewsImage(
        '<meta property="og:image" content="https://img.example/a.jpg">',
        "https://example.com/article"
      )
    ).toBe("https://img.example/a.jpg");
    expect(
      extractNewsImage(
        '<meta content="/b.jpg" name="twitter:image">',
        "https://example.com/article"
      )
    ).toBe("https://example.com/b.jpg");
  });

  it("returns null when no image meta exists", () => {
    expect(extractNewsImage("<html></html>", "https://example.com")).toBeNull();
  });
});

describe("fetchGoogleNews", () => {
  it("parses Indonesian Google News RSS and strips the source suffix", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(rss, { status: 200 }));
    const items = await fetchGoogleNews("BBCA", 1, fetchMock);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("BBCA naik");
    expect(items[0].source).toBe("Kontan");
    expect(Number.isNaN(Date.parse(items[0].published_at!))).toBe(false);
  });
});
