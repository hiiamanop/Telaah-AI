# Telaah Production Terminal Plan

Status: Phase 0 in progress
Date: 2026-11-27
Scope: turn Telaah from a research dashboard into a production-ready,
Bloomberg-style terminal for the Indonesian equity market.

## 1. What Bloomberg actually is

The Bloomberg Terminal is not one screen. It is a client-server market data
system with four recurring capabilities:

- real-time prices, news, analytics, and messaging in one workspace;
- a command line and keyboard-first workflow (`{BBCA IJ Equity GO}`, `HP`,
  `DVD`, `CACS`, `CN`);
- multiple panels and saved layouts for monitoring many instruments at once;
- a proprietary data and distribution network with licensing, SLAs, and
  exchange fees.

Source: [Bloomberg Terminal, Wikipedia](https://en.wikipedia.org/wiki/Bloomberg_Terminal).

A literal clone is not realistic: we do not own Bloomberg's data, news wire,
messaging network, exchange agreements, or decades of terminal engineering.
What we can build is a focused, production-grade **Telaah Terminal** for IDX:
fast symbol lookup, command-driven navigation, multi-panel monitoring,
harmonic/screener analytics, portfolio and alerts, with honest data
provenance.

## 2. Production standard

Production-ready means more than a polished UI. We use the
[Twelve-Factor App](https://12factor.net/) as the baseline:

- config in the environment;
- stateless app processes;
- Redis/Qdrant/scraper treated as attached backing services;
- strict build, release, and run separation;
- logs as event streams;
- graceful shutdown and fast startup;
- dev/prod parity.

For a market terminal we add:

- data freshness and provenance on every quote;
- graceful degradation when a vendor is down;
- cache and rate limits that protect paid APIs;
- health checks, metrics, and alerting;
- backups and restore drills;
- CI, staging, and a repeatable deploy;
- access control, audit logs, and secret management;
- explicit data licensing and compliance.

## 3. Current gap analysis

| Area | Current Telaah | Production terminal target |
|---|---|---|
| Data | IDX scraper, Stockbit session, Yahoo fallback; delayed/best effort | Licensed real-time feed, exchange depth, news wire, corporate actions |
| Latency | Seconds; SSE refresh 5s intraday | Sub-second streaming, sequence numbers, stale-data detection |
| Coverage | IDX equities, limited indices/commodities | Multi-asset: equities, indices, FX, commodities, bonds |
| UI | Separate pages | Multi-panel workspace, command line, saved layouts, keyboard-first |
| Reliability | Single local pod + Cloudflare tunnel; VPS deploy currently fails | HA deploy, health checks, failover, blue/green, backups |
| Observability | Ad-hoc logs | Metrics, traces, centralized logs, SLOs, on-call |
| Security | Cloudflare Access, rate limits | RBAC, audit trail, secret rotation, dependency scanning |
| Caching | File cache + in-memory; Redis for chart; Qdrant cache empty | Redis for numeric/API cache; Qdrant for semantic terminal replay |
| Testing | Vitest suite, tsc, build, lint | CI on every PR, smoke tests, load tests, restore drills |
| Data rights | Vendor sessions/ToS must be respected | Exchange/vendor licenses and redistribution rights |

## 4. Target architecture

```text
                    Cloudflare Access
                           |
                    Next.js app (UI + API)
                    /          |          \
             Redis cache    Qdrant      SSE chart hub
             rate limits    semantic    (pub/sub)
             pub/sub        report
                    \          |          /
                 data adapters / workers
                 /          |           \
          IDX scraper   Stockbit      Yahoo fallback
                 \          |           /
                    market data plane
```

Planned additions:

- **Redis**: exact JSON cache, rate limits, chart pub/sub, alert dedupe,
  queue for background scans.
- **Qdrant**: semantic replay of terminal prompts. Every successful report is
  embedded and stored; repeat or similar prompts reuse it instead of paying
  for another LLM completion.
- **Postgres/Timescale (future)**: durable OHLCV, fundamentals, corporate
  actions, and audit history. Redis is a cache, not the source of truth.
- **Worker (future)**: background scans, alert evaluation, cache warming,
  data reconciliation, and backups.
- **Observability**: `/api/health`, structured logs, Prometheus metrics,
  Grafana dashboards, and alerting.

## 5. Phase 0: production foundation (this batch)

- [x] Redis JSON cache helper with in-process fallback.
- [x] Cache harmonic scan and stats in Redis.
- [x] Cache screener metrics per symbol and per symbol set in Redis.
- [x] Cache corporate actions and dividend calendar.
- [x] Timeframe-aware chart cache refresh: 1D 5s, 1W 15s, 1Y 60s, 5Y 5m.
- [x] Exact terminal prompt cache in Redis, backed by Qdrant semantic cache.
- [x] Qdrant collection created and indexed.
- [x] `/api/health` covering Redis, Qdrant, scraper, and Stockbit session.
- [x] Global command palette (`Cmd/Ctrl+K`) with `BBCA GO`, `BBCA HP`,
      `BBCA HARM`, and function commands.
- [x] CI workflow for typecheck, tests, lint, and build.
- [x] Deploy workflow skips cleanly when VPS secrets are absent.
- [x] Backup script (restore drill still pending).

## 6. Phase 1: terminal workspace

- Multi-panel grid: chart, watchlist, news, screener, harmonic, portfolio.
- Linked symbols: changing the symbol in one panel updates the workspace.
- Saved layouts per user, with local and server persistence.
- Keyboard shortcuts: command palette, next/previous panel, chart timeframe,
  watchlist add/remove, alert create.
- Market clock, session state, and data-freshness badges.
- Unified search across symbols, functions, and commands.

## 7. Phase 2: data quality and coverage

- Licensed real-time IDX feed (or documented delayed feed) with provenance.
- Stale-data detection and automatic fallback badges.
- Exchange calendar, suspensions, corporate actions, dividends.
- News integration with source and timestamp.
- Data reconciliation: compare vendors, flag gaps, never fabricate values.

## 8. Phase 3: analytics and workflows

- Harmonic swing presets: 4H/1D for daily swing, 1W for weekly swing.
- Screener presets and saved universes.
- Portfolio risk: exposure, sector concentration, drawdown, dividend calendar.
- Alert center: harmonic PRZ, bandar phase, price/volume/flow, session expiry.
- Walk-forward validation and cost-aware outcome stats.

## 9. Phase 4: production operations

- Staging environment and blue/green deploy.
- Prometheus/Grafana/Loki (or hosted equivalent) with SLOs.
- Backups for Redis, Qdrant, and durable data; quarterly restore drill.
- Load tests for chart SSE and screener scans.
- Dependency and container scanning.
- RBAC, audit log, secret rotation, incident runbooks.

## 10. Non-goals and risks

- We are not cloning Bloomberg's proprietary data, news, messaging, or
  trading network.
- Live order execution remains out of scope until a licensed broker API and
  risk controls exist.
- Real-time redistribution of exchange data requires a commercial license.
- A "Bloomberg-style" UI does not make delayed data real-time; provenance must
  stay visible.

## 11. Sources

- [Bloomberg Terminal — Wikipedia](https://en.wikipedia.org/wiki/Bloomberg_Terminal)
- [The Twelve-Factor App](https://12factor.net/)
