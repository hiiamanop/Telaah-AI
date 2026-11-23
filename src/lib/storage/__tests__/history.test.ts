import { beforeEach, describe, expect, it, vi } from "vitest";
import { getReportFromCache, isReportCacheCompatible } from "../history";

const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  vi.stubGlobal("window", {});
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
  });
});

describe("report cache versioning", () => {
  it("ignores a report from an older data source/version", () => {
    localStorage.setItem(
      "telaah360_cache_rep_BBCA",
      JSON.stringify({ symbol: "BBCA", dataSource: "sectors", dataVersion: 0 })
    );
    expect(getReportFromCache("BBCA")).toBeNull();
    expect(isReportCacheCompatible({ dataSource: "sectors", dataVersion: 0 })).toBe(false);
  });

  it("accepts an open-market report at version 1", () => {
    expect(isReportCacheCompatible({ dataSource: "open-market", dataVersion: 1 })).toBe(true);
  });
});
