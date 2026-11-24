"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  ColorType,
  CrosshairMode,
  createChart,
  type CandlestickData,
  type HistogramData,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import type { ChartCandle } from "@/lib/market/scraper-client";

interface LiveChartProps {
  candles: ChartCandle[];
  intraday: boolean;
  height?: number;
}

function chartTime(candle: ChartCandle, intraday: boolean): Time {
  // lightweight-charts renders UTCTimestamp in UTC. Shift WIB bars so the
  // axis reads 09:00–16:00 instead of 02:00–09:00.
  if (intraday) return (candle.time + 7 * 3600) as UTCTimestamp;
  return candle.date ?? new Date(candle.time * 1000).toISOString().slice(0, 10);
}

export const LiveChart: React.FC<LiveChartProps> = ({
  candles,
  intraday,
  height = 430,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const [hovered, setHovered] = useState<ChartCandle | null>(null);
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setIsDark(root.classList.contains("dark"));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const dark = document.documentElement.classList.contains("dark");
    const chart = createChart(container, {
      width: container.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: dark ? "#8B95A7" : "#64748b",
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
      },
      grid: {
        vertLines: { color: dark ? "rgba(148, 163, 184, 0.08)" : "rgba(100, 116, 139, 0.16)" },
        horzLines: { color: dark ? "rgba(148, 163, 184, 0.08)" : "rgba(100, 116, 139, 0.16)" },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: {
        borderColor: "rgba(148, 163, 184, 0.2)",
      },
      timeScale: {
        borderColor: "rgba(148, 163, 184, 0.2)",
        timeVisible: intraday,
        secondsVisible: false,
        rightOffset: 4,
      },
      localization: {
        locale: "id-ID",
      },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: "#10b981",
      downColor: "#f43f5e",
      borderVisible: false,
      wickUpColor: "#10b981",
      wickDownColor: "#f43f5e",
      priceFormat: { type: "price", precision: 0, minMove: 1 },
    });
    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "",
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });

    chart.subscribeCrosshairMove((param) => {
      if (!param.time) {
        setHovered(null);
        return;
      }
      const data = param.seriesData.get(candleSeries) as CandlestickData | undefined;
      if (!data) {
        setHovered(null);
        return;
      }
      const found = candles.find(
        (candle) => chartTime(candle, intraday) === param.time
      );
      if (found) setHovered(found);
    });

    const observer = new ResizeObserver(() => {
      chart.applyOptions({ width: container.clientWidth });
    });
    observer.observe(container);

    chartRef.current = chart;
    candleRef.current = candleSeries;
    volumeRef.current = volumeSeries;

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      volumeRef.current = null;
    };
  }, [height, intraday]);

  useEffect(() => {
    if (!candleRef.current || !volumeRef.current || candles.length === 0) return;
    const candleData: CandlestickData[] = candles.map((candle) => ({
      time: chartTime(candle, intraday),
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    }));
    const volumeData: HistogramData[] = candles.map((candle) => ({
      time: chartTime(candle, intraday),
      value: candle.volume,
      color:
        candle.close >= candle.open
          ? "rgba(16, 185, 129, 0.3)"
          : "rgba(244, 63, 94, 0.3)",
    }));
    candleRef.current.setData(candleData);
    volumeRef.current.setData(volumeData);
    chartRef.current?.timeScale().fitContent();
  }, [candles, intraday]);

  useEffect(() => {
    chartRef.current?.applyOptions({
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: isDark ? "#8B95A7" : "#64748b",
      },
      grid: {
        vertLines: { color: isDark ? "rgba(148, 163, 184, 0.08)" : "rgba(100, 116, 139, 0.16)" },
        horzLines: { color: isDark ? "rgba(148, 163, 184, 0.08)" : "rgba(100, 116, 139, 0.16)" },
      },
    });
  }, [isDark]);

  const current = hovered ?? candles[candles.length - 1];

  return (
    <div className="relative w-full">
      {current && (
        <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-slate-200/80 bg-white/80 px-3 py-1.5 text-[10px] font-mono text-slate-600 backdrop-blur-sm dark:border-slate-700/70 dark:bg-black/70 dark:text-slate-300 sm:absolute sm:left-3 sm:top-3 sm:z-10 sm:mb-0">
          <span className="text-slate-500">
            {current.date ??
              new Date(current.time * 1000).toLocaleDateString("id-ID")}
          </span>
          <span>
            O <b className="text-zinc-900 dark:text-slate-100">{current.open.toLocaleString("id-ID")}</b>
          </span>
          <span>
            H <b className="text-emerald-600 dark:text-emerald-400">{current.high.toLocaleString("id-ID")}</b>
          </span>
          <span>
            L <b className="text-rose-600 dark:text-rose-400">{current.low.toLocaleString("id-ID")}</b>
          </span>
          <span>
            C <b className="text-zinc-900 dark:text-slate-100">{current.close.toLocaleString("id-ID")}</b>
          </span>
          <span>
            Vol <b className="text-zinc-900 dark:text-slate-100">{(current.volume / 1e6).toFixed(2)}M</b>
          </span>
        </div>
      )}
      <div ref={containerRef} className="w-full" />
    </div>
  );
};
