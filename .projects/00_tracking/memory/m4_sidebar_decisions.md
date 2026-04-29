---
name: M4 sidebar / CA EQUITIES decisions
description: Collapse-only parent sidebar nodes (no aggregated view), always-expanded initial state, TSX same TTL as US
type: project
---

Resolved for M4 CA EQUITIES (2026-04-24, S5):

### Parent sector_group nodes are collapse/expand only
Clicking "CA EQUITIES" toggles its 5 child rows visible/hidden. The parent does NOT show an aggregated 31-ticker grid.

- **Why:** Aggregation across Energy/Banking/Telecom/Miners/Metals provides no cognitive structure — it's just "stocks that trade in Canada". The 5 sub-sector grids are why this section exists.
- **How to apply:** Same rule will govern any future hierarchical sidebar group (e.g. if INDICES adds Americas/Europe/Asia-Pacific children later). Parents never own a dashboard view; only leaf sector_groups do. If a "show me all CA stocks" view is ever wanted, add it as a separate route under POWER features, not as parent-node behavior.

### Initial expand/collapse state: always expanded, not persisted
Sidebar starts with all parent groups expanded on every launch. Collapse state is NOT saved across launches in M4.

- **Why:** Session persistence is a M8 feature (#7). Avoid building a mini version of it now.
- **How to apply:** When M8 lands, fold sidebar expand/collapse state into the `config` KV alongside last-ticker/timeframe/toggles. Key: `sidebar.collapsed.<parent_id> = '1' | '0'`.

### TSX tickers use the same 15-min TTL as US equities
No adaptive after-hours cadence for CA yet.

- **Why:** DESIGN.md's "Yahoo TSX after-hours cadence" is in the Discovered list. Solving it requires market-hours logic server-side, which is already deferred per `m3_ticker_decisions.md` (#2 — adaptive quote TTL). Solve once, not per-region.
- **How to apply:** When adaptive TTL lands, TSX inherits it automatically — it'll be keyed on the ticker's exchange inferred from the `.TO` suffix.
