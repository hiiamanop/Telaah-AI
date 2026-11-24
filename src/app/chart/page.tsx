"use client";

import React, { useEffect, useRef, useState } from "react";
import { Header } from "@/components/Header";
import { LiveChart } from "@/components/LiveChart";
import type { ChartCandle } from "@/lib/market/scraper-client";
import {
  Activity,
  BarChart3,
  Loader2,
  RefreshCw,
  Search,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

type ChartTimeframe = "1D" | "1W" | "1Y" | "5Y";

const QUICK_SYMBOLS = ["BBCA", "BBRI", "BMRI", "TLKM", "ASII"];
const TIMEFRAMES: Array<{ key: ChartTimeframe; label: string; hint: string }> = [
  { key: "1D", label: "1D", hint: "intraday" },
  { key: "1W", label: "1W", hint: "hourly" },
  { key: "1Y", label: "1Y", hint: "daily" },
  { key: "5Y", label: "5Y", hint: "weekly" },
];

export default function ChartPage() {
  const [symbol, setSymbol] = useState("BBCA");
  const [symbolInput, setSymbolInput] = useState("BBCA");
  const [timeframe, setTimeframe] = useState<ChartTimeframe>("1W");
  const [candles, setCandles] = useState<ChartCandle[]>([]);
  const [source, setSource] = useState<"stockbit" | "yahoo" | null>(null);
  const [delayed, setDelayed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const requestRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const intraday = timeframe === "1D" || timeframe === "1W";

  useEffect(() => {
    let cancelled = false;
    const run = async (silent: boolean) => {
      const requestId = ++requestRef.current;
      if (!silent) setIsLoading(true);
      else setIsRefreshing(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/chart?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}`,
          { cache: "no-store" }
        );
        const data = await response.json();
        if (cancelled || requestId !== requestRef.current) return;
        if (!response.ok || !data.success) {
          throw new Error(data.error || "Gagal memuat chart.");
        }
        setCandles(data.candles ?? []);
        setSource(data.source ?? null);
        setDelayed(Boolean(data.delayed));
        setLastUpdated(
          new Date().toLocaleTimeString("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })
        );
      } catch (err) {
        if (cancelled || requestId !== requestRef.current) return;
        setError(err instanceof Error ? err.message : "Gagal memuat chart.");
      } finally {
        if (!cancelled && requestId === requestRef.current) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    };

    run(false);
    const timer = setInterval(
      () => run(true),
      intraday ? 30_000 : 120_000
    );
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [symbol, timeframe, intraday]);

  const submitSymbol = () => {
    const clean = symbolInput.trim().toUpperCase().replace(".JK", "");
    if (!/^[A-Z]{4}$/.test(clean)) {
      setError("Kode emiten harus 4 huruf, misalnya BBCA.");
      return;
    }
    setSymbol(clean);
  };

  const last = candles[candles.length - 1];
  const previous = candles[candles.length - 2];
  const changePct =
    last && previous && previous.close > 0
      ? ((last.close - previous.close) / previous.close) * 100
      : 0;
  const isPositive = changePct >= 0;

  return (
    <div className="min-h-[100dvh] flex flex-col bg-[#f7f7f8] dark:bg-[#121214] text-zinc-900 dark:text-zinc-100 transition-colors">
      <Header onFocusSearch={() => inputRef.current?.focus()} />

      <main id="main-content" className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-5 lg:px-6 py-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-[#0b0b0c] border border-slate-200 dark:border-white/10 p-3.5 rounded-lg">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-sm font-bold tracking-tight text-zinc-950 dark:text-white uppercase font-mono">
                  IDX Live Chart
                </h1>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10">
                  {source === "stockbit"
                    ? "Stockbit realtime"
                    : source === "yahoo"
                      ? "Yahoo delayed"
                      : "Sumber belum tersedia"}
                </span>
                {isRefreshing && (
                  <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                    <RefreshCw className="w-3 h-3 animate-spin" /> refresh
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Chart intraday dan historis. Stockbit realtime bila sesi aktif; fallback Yahoo bila tidak.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
            <span className="text-slate-500 text-[10px] uppercase">Cepat:</span>
            {QUICK_SYMBOLS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setSymbol(item);
                  setSymbolInput(item);
                }}
                className={`px-2 py-0.5 rounded transition ${
                  symbol === item
                    ? "bg-indigo-600 text-white font-bold"
                    : "bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
              <input
                ref={inputRef}
                value={symbolInput}
                onChange={(event) => setSymbolInput(event.target.value.toUpperCase())}
                onKeyDown={(event) => {
                  if (event.key === "Enter") submitSymbol();
                }}
                placeholder="Cari kode emiten..."
                className="w-44 pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-white/5 rounded border border-slate-200 dark:border-white/10 text-xs text-zinc-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-slate-400 dark:focus:border-slate-600 font-mono"
              />
            </div>
            <button
              type="button"
              onClick={submitSymbol}
              className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-bold transition"
            >
              Buka
            </button>
          </div>

          <div className="flex items-center gap-1 text-[10px] font-mono">
            {TIMEFRAMES.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setTimeframe(item.key)}
                className={`px-2.5 py-1 rounded-lg border transition ${
                  timeframe === item.key
                    ? "bg-indigo-600/15 dark:bg-indigo-600/20 border-indigo-500 text-indigo-700 dark:text-indigo-300 font-bold"
                    : "bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
                title={item.hint}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-[#0b0b0c] rounded-xl border border-slate-200 dark:border-white/10 p-3 sm:p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-baseline gap-3">
              <span className="font-mono font-bold text-lg text-zinc-950 dark:text-white">{symbol}</span>
              {last && (
                <span className="font-mono text-sm text-slate-700 dark:text-slate-200">
                  Rp {last.close.toLocaleString("id-ID")}
                </span>
              )}
              <span
                className={`inline-flex items-center gap-0.5 text-xs font-mono font-bold ${
                  isPositive
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                }`}
              >
                {isPositive ? (
                  <TrendingUp className="w-3.5 h-3.5" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5" />
                )}
                {isPositive ? "+" : ""}
                {changePct.toFixed(2)}%
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[10px] font-mono text-slate-500">
              <span>
                Sumber:{" "}
                <span className="text-slate-700 dark:text-slate-300">
                  {source === "stockbit"
                    ? "Stockbit"
                    : source === "yahoo"
                      ? "Yahoo"
                      : "—"}
                </span>
              </span>
              {delayed && (
                <span className="text-amber-600 dark:text-amber-400">
                  delayed / bukan realtime
                </span>
              )}
              {lastUpdated && <span>Update {lastUpdated}</span>}
              {last && (
                <span>
                  Vol {(last.volume / 1e6).toFixed(2)}M · {candles.length} candle
                </span>
              )}
            </div>
          </div>

          {isLoading ? (
            <div className="h-[430px] flex items-center justify-center text-xs font-mono text-slate-500 dark:text-slate-400 gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-500 dark:text-indigo-400" />
              Memuat chart {symbol}...
            </div>
          ) : error ? (
            <div className="h-[430px] flex items-center justify-center text-xs text-rose-600 dark:text-rose-300">
              {error}
            </div>
          ) : candles.length === 0 ? (
            <div className="h-[430px] flex items-center justify-center text-xs text-slate-500 dark:text-slate-400">
              Data chart tidak tersedia untuk {symbol}.
            </div>
          ) : (
            <>
              <LiveChart candles={candles} intraday={intraday} />
              {intraday && candles.length < 10 && (
                <p className="text-[10px] text-amber-600 dark:text-amber-400">
                  Stockbit hanya mengirim {candles.length} bar intraday untuk sesi ini.
                  Pilih 1Y atau 5Y untuk melihat riwayat harian.
                </p>
              )}
            </>
          )}
        </div>

        <p className="text-[10px] text-slate-500">
          Chart ini untuk riset dan edukasi. Stockbit adalah sumber tidak resmi dengan sesi
          pribadi; Yahoo adalah fallback tertunda. Bukan rekomendasi beli/jual.
        </p>
      </main>
    </div>
  );
}
