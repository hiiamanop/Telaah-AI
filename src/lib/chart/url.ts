export function chartQuery(
  symbol: string,
  timeframe: string,
  harmonicTimeframe: string | null
): string {
  const params = new URLSearchParams({ symbol, tf: timeframe });
  if (harmonicTimeframe) params.set("htf", harmonicTimeframe);
  return params.toString();
}
