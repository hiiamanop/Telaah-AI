"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Clock3, Globe2, Loader2, Newspaper, RefreshCw, Search } from "lucide-react";
import { Header } from "@/components/Header";
import type { MarketItem } from "@/lib/storage/market-cache";
import type { NewsItem } from "@/lib/sectors/types";

function formatRelative(iso: string | undefined): string {
  if (!iso) return "";
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return "";
  const minutes = Math.max(0, Math.floor((Date.now() - time) / 60_000));
  if (minutes < 60) return `${minutes} mnt lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  return new Date(time).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
  });
}

export default function NewsPage() {
  const [symbol, setSymbol] = useState("IHSG");
  const [query, setQuery] = useState("IHSG");
  const [news, setNews] = useState<NewsItem[]>([]);
  const [market, setMarket] = useState<MarketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadNews = async (target: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/news?symbol=${encodeURIComponent(target)}&limit=20`,
        { cache: "no-store" }
      );
      const data = await response.json();
      if (!data.success) throw new Error(data.error || "Gagal memuat news.");
      setNews(data.items ?? []);
      setSymbol(data.symbol ?? target);
      setQuery(data.symbol ?? target);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat news.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadNews("IHSG");
    fetch("/api/market-overview", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (data?.success && Array.isArray(data.indices)) {
          setMarket(data.indices as MarketItem[]);
        }
      })
      .catch(() => null);
  }, []);

  const indices = useMemo(
    () =>
      market.filter((item) =>
        ["COMPOSITE", "LQ45", "IDX30"].includes(item.code)
      ),
    [market]
  );
  const macro = useMemo(
    () =>
      market.filter(
        (item) => !["COMPOSITE", "LQ45", "IDX30"].includes(item.code)
      ),
    [market]
  );

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const clean = query.trim().toUpperCase().replace(".JK", "");
    void loadNews(/^[A-Z]{4}$/.test(clean) ? clean : "IHSG");
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-[#f7f7f8] dark:bg-[#121214] text-zinc-900 dark:text-zinc-100 transition-colors">
      <Header />
      <main id="main-content" className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-5 lg:px-6 py-4 space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-400">
                <Newspaper className="h-4 w-4" />
              </span>
              <h1 className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-white">
                News & Markets
              </h1>
              <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 font-mono text-[10px] text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400">
                delayed / public sources
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Headline dari Google News RSS, indeks, FX, dan komoditas. Bukan
              news wire berlisensi dan bukan real-time exchange feed.
            </p>
          </div>
          <form onSubmit={submit} className="flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value.toUpperCase())}
                placeholder="BBCA atau IHSG"
                className="h-9 w-44 rounded-lg border border-slate-200 bg-white pl-8 pr-3 font-mono text-xs text-zinc-900 outline-none dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-100"
                aria-label="Cari news"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-zinc-900 px-3 text-xs font-medium text-white transition hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Muat
            </button>
          </form>
        </div>

        <section className="rounded-xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-[#0b0b0c]">
          <div className="mb-2 flex items-center gap-2">
            <Globe2 className="h-3.5 w-3.5 text-sky-500" />
            <h2 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Macro & markets
            </h2>
            <span className="font-mono text-[9px] text-slate-400">
              Yahoo, delayed
            </span>
          </div>
          {market.length === 0 ? (
            <p className="py-3 text-[11px] text-slate-500 dark:text-slate-400">
              Data pasar belum tersedia.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {[...indices, ...macro].map((item) => (
                <div
                  key={item.code}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-white/10 dark:bg-white/[0.03]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">
                      {item.name}
                    </span>
                    <span
                      className={`font-mono text-[10px] ${
                        item.isPositive
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {item.change || "—"}
                    </span>
                  </div>
                  <div className="mt-0.5 font-mono text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {item.price}
                    {item.unit ? (
                      <span className="ml-1 text-[9px] font-normal text-slate-400">
                        {item.unit}
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="mt-2 text-[9px] text-slate-400">
            Bond yield dan options depth belum tersedia dari sumber publik ini.
          </p>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-[#0b0b0c]">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-white/[0.06]">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {symbol} news
              </h2>
              <p className="mt-0.5 text-[10px] text-slate-400">
                Google News RSS · headline dan sumber asli
              </p>
            </div>
            {loading && (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-500" />
            )}
          </div>
          {error ? (
            <p className="px-4 py-4 text-[11px] text-rose-600 dark:text-rose-300">
              {error}
            </p>
          ) : news.length === 0 && !loading ? (
            <p className="px-4 py-4 text-[11px] text-slate-500 dark:text-slate-400">
              Belum ada headline untuk {symbol}.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-white/[0.06]">
              {news.map((item, index) => (
                <li key={`${item.title}-${index}`} className="px-4 py-3">
                  <a
                    href={item.url ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="block text-xs font-medium text-zinc-900 transition hover:text-sky-600 dark:text-zinc-100 dark:hover:text-sky-400"
                  >
                    {item.title}
                  </a>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[9px] text-slate-400">
                    <span>{item.source ?? "News"}</span>
                    <span className="inline-flex items-center gap-1">
                      <Clock3 className="h-2.5 w-2.5" />
                      {formatRelative(item.published_at)}
                    </span>
                    <Link
                      href={`/chart?symbol=${symbol}&tf=1Y`}
                      className="text-slate-500 hover:text-zinc-900 dark:hover:text-white"
                    >
                      buka chart →
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
