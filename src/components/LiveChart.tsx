"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  ColorType,
  CrosshairMode,
  createChart,
  type CandlestickData,
  type HistogramData,
  type IChartApi,
  TickMarkType,
  type ISeriesApi,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import type { ChartCandle } from "@/lib/market/scraper-client";

interface LiveChartProps {
  candles: ChartCandle[];
  intraday: boolean;
  dataKey: string;
  height?: number;
}

function chartTime(candle: ChartCandle, intraday: boolean): Time {
  // lightweight-charts renders UTCTimestamp in UTC. Shift WIB bars so the
  // axis reads 09:00–16:00 instead of 02:00–09:00.
  if (intraday) return (candle.time + 7 * 3600) as UTCTimestamp;
  return candle.date ?? new Date(candle.time * 1000).toISOString().slice(0, 10);
}

function formatAxisTime(time: Time, tickMarkType?: TickMarkType): string {
  if (typeof time === "number") {
    const date = new Date(time * 1000);
    if (
      tickMarkType === TickMarkType.DayOfMonth ||
      tickMarkType === TickMarkType.Month ||
      tickMarkType === TickMarkType.Year
    ) {
      return date.toLocaleDateString("id-ID", {
        day: tickMarkType === TickMarkType.Year ? undefined : "2-digit",
        month: "short",
        year: tickMarkType === TickMarkType.Year ? "numeric" : undefined,
        timeZone: "UTC",
      });
    }
    return date.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    });
  }
  const date = new Date(`${String(time)}T00:00:00Z`);
  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
}

function legendTime(candle: ChartCandle, intraday: boolean): string {
  if (!intraday) {
    return (
      candle.date ??
      new Date(candle.time * 1000).toLocaleDateString("id-ID")
    );
  }
  return new Date((candle.time + 7 * 3600) * 1000).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

function volumeLabel(value: number): string {
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return value.toLocaleString("id-ID");
}

export const LiveChart: React.FC<LiveChartProps> = ({
  candles,
  intraday,
  dataKey,
  height = 460,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const dataKeyRef = useRef<string>("");
  const firstTimeRef = useRef<string>("");
  const lastTimeRef = useRef<string>("");
  const candlesRef = useRef<ChartCandle[]>(candles);
  const [hovered, setHovered] = useState<ChartCandle | null>(null);
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    candlesRef.current = candles;
  }, [candles]);

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
      height: container.clientWidth < 640 ? Math.min(height, 340) : height,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: dark ? "#8B95A7" : "#64748b",
        fontFamily: "Poppins, ui-sans-serif, system-ui, sans-serif",
        fontSize: 11,
      },
      grid: {
        vertLines: {
          color: dark
            ? "rgba(148, 163, 184, 0.08)"
            : "rgba(100, 116, 139, 0.14)",
        },
        horzLines: {
          color: dark
            ? "rgba(148, 163, 184, 0.08)"
            : "rgba(100, 116, 139, 0.14)",
        },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "rgba(148, 163, 184, 0.4)", width: 1 },
        horzLine: { color: "rgba(148, 163, 184, 0.4)", width: 1 },
      },
      rightPriceScale: {
        borderColor: dark
          ? "rgba(148, 163, 184, 0.2)"
          : "rgba(100, 116, 139, 0.25)",
        scaleMargins: { top: 0.08, bottom: 0.22 },
      },
      timeScale: {
        borderColor: dark
          ? "rgba(148, 163, 184, 0.2)"
          : "rgba(100, 116, 139, 0.25)",
        timeVisible: intraday,
        secondsVisible: false,
        rightOffset: 4,
        barSpacing: 8,
        tickMarkFormatter: (time: Time, tickMarkType: TickMarkType) =>
          formatAxisTime(time, tickMarkType),
      },
      localization: {
        locale: "id-ID",
        priceFormatter: (price: number) =>
          price.toLocaleString("id-ID", { maximumFractionDigits: 0 }),
        timeFormatter: (time: Time) => formatAxisTime(time),
      },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: "#10b981",
      downColor: "#f43f5e",
      borderVisible: false,
      wickUpColor: "#10b981",
      wickDownColor: "#f43f5e",
      priceFormat: { type: "price", precision: 0, minMove: 1 },
      priceLineColor: "#10b981",
      priceLineStyle: 2,
    });
    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "",
      lastValueVisible: false,
      priceLineVisible: false,
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.84, bottom: 0 },
    });

    chart.subscribeCrosshairMove((param) => {
      if (!param.time) {
        setHovered(null);
        return;
      }
      const found = candlesRef.current.find(
        (candle) => chartTime(candle, intraday) === param.time
      );
      setHovered(found ?? null);
    });

    const observer = new ResizeObserver(() => {
      const width = container.clientWidth;
      chart.applyOptions({
        width,
        height: width < 640 ? Math.min(height, 340) : height,
      });
    });
    observer.observe(container);

    chartRef.current = chart;
    candleRef.current = candleSeries;
    volumeRef.current = volumeSeries;
    dataKeyRef.current = "";
    firstTimeRef.current = "";
    lastTimeRef.current = "";

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
          ? "rgba(16, 185, 129, 0.32)"
          : "rgba(244, 63, 94, 0.32)",
    }));

    const nextFirst = String(candleData[0].time);
    const nextLast = String(candleData[candleData.length - 1].time);
    const sameSeries =
      dataKeyRef.current === dataKey && firstTimeRef.current === nextFirst;

    if (!sameSeries) {
      candleRef.current.setData(candleData);
      volumeRef.current.setData(volumeData);
      chartRef.current?.timeScale().fitContent();
      dataKeyRef.current = dataKey;
      firstTimeRef.current = nextFirst;
      lastTimeRef.current = nextLast;
      return;
    }

    if (lastTimeRef.current === nextLast) {
      candleRef.current.update(candleData[candleData.length - 1]);
      volumeRef.current.update(volumeData[volumeData.length - 1]);
      return;
    }

    // A new bar arrived. Update only the bars the stream added so the user's
    // zoom and scroll position stay where they were.
    const previousLast = lastTimeRef.current;
    const start = candleData.findIndex(
      (candle) => String(candle.time) === previousLast
    );
    for (let index = Math.max(0, start); index < candleData.length; index += 1) {
      candleRef.current.update(candleData[index]);
      volumeRef.current.update(volumeData[index]);
    }
    lastTimeRef.current = nextLast;
  }, [candles, intraday, dataKey]);

  useEffect(() => {
    chartRef.current?.applyOptions({
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: isDark ? "#8B95A7" : "#64748b",
      },
      grid: {
        vertLines: {
          color: isDark
            ? "rgba(148, 163, 184, 0.08)"
            : "rgba(100, 116, 139, 0.14)",
        },
        horzLines: {
          color: isDark
            ? "rgba(148, 163, 184, 0.08)"
            : "rgba(100, 116, 139, 0.14)",
        },
      },
    });
  }, [isDark]);

  const current = hovered ?? candles[candles.length - 1];

  return (
    <div className="w-full">
      {current && (
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg border border-slate-200/80 bg-slate-50/80 px-3 py-2 text-[10px] font-mono text-slate-500 dark:border-white/[0.06] dark:bg-white/[0.02] dark:text-slate-400">
          <span className="text-slate-400 dark:text-slate-500">
            {legendTime(current, intraday)}
          </span>
          <span>
            O{" "}
            <b className="text-zinc-900 dark:text-slate-100">
              {current.open.toLocaleString("id-ID")}
            </b>
          </span>
          <span>
            H{" "}
            <b className="text-emerald-600 dark:text-emerald-400">
              {current.high.toLocaleString("id-ID")}
            </b>
          </span>
          <span>
            L{" "}
            <b className="text-rose-600 dark:text-rose-400">
              {current.low.toLocaleString("id-ID")}
            </b>
          </span>
          <span>
            C{" "}
            <b className="text-zinc-900 dark:text-slate-100">
              {current.close.toLocaleString("id-ID")}
            </b>
          </span>
          <span>
            Vol{" "}
            <b className="text-zinc-900 dark:text-slate-100">
              {volumeLabel(current.volume)}
            </b>
          </span>
        </div>
      )}
      <div ref={containerRef} className="w-full" />
    </div>
  );
};
