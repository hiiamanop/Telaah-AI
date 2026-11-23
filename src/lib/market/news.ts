import { XMLParser } from "fast-xml-parser";
import type { NewsItem } from "@/lib/sectors/types";

const NEWS_BASE = "https://news.google.com/rss/search";
const CACHE_TTL_MS = 15 * 60 * 1000;
const DEFAULT_LIMIT = 5;
const REQUEST_TIMEOUT_MS = 10_000;

const parser = new XMLParser({
  ignoreAttributes: true,
  processEntities: true,
  htmlEntities: true,
  parseTagValue: false,
  trimValues: true,
});

interface RssItem {
  title?: unknown;
  link?: unknown;
  pubDate?: unknown;
  source?: unknown;
}

interface RssBody {
  rss?: { channel?: { item?: RssItem | RssItem[] } };
}

interface NewsCacheEntry {
  items: NewsItem[];
  expiresAt: number;
}

const cache = new Map<string, NewsCacheEntry>();

function asText(value: unknown): string | undefined {
  if (typeof value === "string") {
    const text = value.trim();
    return text ? text : undefined;
  }
  if (typeof value === "number") return String(value);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return asText(record["#text"]);
  }
  return undefined;
}

function stripSourceSuffix(title: string, source: string | undefined): string {
  if (!source) return title;
  const suffix = ` - ${source}`;
  return title.endsWith(suffix) ? title.slice(0, -suffix.length).trim() : title;
}

function toNewsItem(item: RssItem): NewsItem | null {
  const title = asText(item.title);
  if (!title) return null;

  const source = asText(item.source);
  const link = asText(item.link);
  const pubDate = asText(item.pubDate);

  const news: NewsItem = { title: stripSourceSuffix(title, source) };
  if (link) news.url = link;
  if (source) news.source = source;
  if (pubDate) {
    const ms = Date.parse(pubDate);
    // Keep an unparseable date as-is instead of inventing one.
    news.published_at = Number.isNaN(ms) ? pubDate : new Date(ms).toISOString();
  }
  return news;
}

function parseRss(xml: string): NewsItem[] {
  const parsed = parser.parse(xml) as RssBody;
  const raw = parsed?.rss?.channel?.item;
  const items = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return items
    .map(toNewsItem)
    .filter((item): item is NewsItem => item !== null);
}

/**
 * Indonesian Google News headlines for a ticker. Failures return an empty list:
 * a missing headline is better than a fabricated one.
 */
export async function fetchGoogleNews(
  symbol: string,
  limit: number = DEFAULT_LIMIT,
  fetchImpl: typeof fetch = fetch
): Promise<NewsItem[]> {
  const clean = symbol.trim().toUpperCase();
  if (!clean) return [];

  const wanted = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : DEFAULT_LIMIT;

  const cached = cache.get(clean);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.items.slice(0, wanted);
  }

  const url = `${NEWS_BASE}?q=${encodeURIComponent(clean)}+saham&hl=id&gl=ID&ceid=ID:id`;

  try {
    const res = await fetchImpl(url, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) return [];

    const xml = await res.text();
    const items = parseRss(xml);
    cache.set(clean, { items, expiresAt: Date.now() + CACHE_TTL_MS });
    return items.slice(0, wanted);
  } catch {
    return [];
  }
}
