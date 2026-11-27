"use client";

import React, { useEffect, useState } from "react";
import { ArrowDownUp } from "lucide-react";
import type { StockbitQuote } from "@/lib/market/scraper-client";

function formatPrice(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  return value.toLocaleString("id-ID", { maximumFractionDigits: 0 });
}

function formatVolume(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return value.toLocaleString("id-ID");
}

export function DepthCard({ symbol }: { symbol: string }) {
  const [quote, setQuote] = useState<StockbitQuote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const load = async () => {
      try {
        const response = await fetch(
          `/api/quote?symbol=${encodeURIComponent(symbol)}`,
          { cache: "no-store" }
        );
        const data = await response.json();
        if (cancelled) return;
        if (data.success) {
          setQuote(data.quote as StockbitQuote);
          setError(null);
        } else {
          setQuote(null);
          setError(data.error || "Order book tidak tersedia.");
        }
      } catch {
        if (!cancelled) setError("Order book tidak tersedia.");
      } finally {
        if (!cancelled) {
          setLoading(false);
          timer = setTimeout(load, 5_000);
        }
      }
    };

    setQuote(null);
    setError(null);
    setLoading(true);
    void load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [symbol]);

  const offers = (quote?.offers ?? []).slice(0, 5);
  const bids = (quote?.bids ?? []).slice(0, 5);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-white/10 dark:bg-[#0b0b0c]">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          <ArrowDownUp className="h-3.5 w-3.5 text-indigo-500" />
          Order book
        </h2>
        <span className="font-mono text-[9px] text-slate-400">
          {quote ? "Stockbit" : loading ? "memuat" : "N/A"}
        </span>
      </div>

      {error ? (
        <div className="mt-2 space-y-1">
          <p className="text-[10px] text-amber-600 dark:text-amber-400">
            {error}
          </p>
          <p className="text-[9px] leading-relaxed text-slate-400">
            Depth bursa penuh memerlukan feed berlisensi; yang tersedia hanya
            top-5 dari Stockbit.
          </p>
        </div>
      ) : quote ? (
        <div className="mt-2 space-y-2">
          <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
            <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 px-2 py-1.5">
              <div className="text-[8px] uppercase text-emerald-600 dark:text-emerald-400">
                Bid
              </div>
              <div className="font-semibold text-emerald-700 dark:text-emerald-300">
                {formatPrice(quote.bid)}
              </div>
            </div>
            <div className="rounded-md border border-rose-500/20 bg-rose-500/5 px-2 py-1.5">
              <div className="text-[8px] uppercase text-rose-600 dark:text-rose-400">
                Offer
              </div>
              <div className="font-semibold text-rose-700 dark:text-rose-300">
                {formatPrice(quote.offer)}
              </div>
            </div>
          </div>

          <div className="space-y-0.5 font-mono text-[9px]">
            {[...offers].reverse().map((level, index) => (
              <div
                key={`offer-${level.price}-${index}`}
                className="flex items-center justify-between rounded px-1.5 py-0.5 text-rose-600 dark:text-rose-400"
              >
                <span>Offer</span>
                <span>{formatPrice(level.price)}</span>
                <span className="text-slate-400">{formatVolume(level.volume)}</span>
              </div>
            ))}
            {bids.map((level, index) => (
              <div
                key={`bid-${level.price}-${index}`}
                className="flex items-center justify-between rounded px-1.5 py-0.5 text-emerald-600 dark:text-emerald-400"
              >
                <span>Bid</span>
                <span>{formatPrice(level.price)}</span>
                <span className="text-slate-400">{formatVolume(level.volume)}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 pt-1.5 font-mono text-[9px] text-slate-400 dark:border-white/[0.06]">
            <span>ARA {formatPrice(quote.ara)}</span>
            <span>ARB {formatPrice(quote.arb)}</span>
          </div>
          <p className="text-[9px] leading-relaxed text-slate-400">
            Top-5, unofficial, near-real-time. Bukan depth bursa penuh.
          </p>
        </div>
      ) : (
        <p className="mt-2 text-[10px] text-slate-400">
          Memuat order book...
        </p>
      )}
    </section>
  );
}
