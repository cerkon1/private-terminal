# Database Expansion — Pre-Pulse Reformulation (v1.2 prep)

Draft, 2026-05-02. Companion to `pulse_design.md` in this folder. Status: **design locked, implementation pending**. Phase 0 of the Pulse v1.2 build — must ship before Pulse so the cross-section heatmap launches against a richer, structurally symmetric universe.

---

## TL;DR

Reformulate the watchlist seed from the current 72 tickers / 25 macro series across 8 sector groups into **170 tickers / 29 macro series across 8 top-level groups with parallel sub-sectoring**. The headline change: US EQUITIES gets the same 10 sub-sectors as CA EQUITIES (Tech / Banking / Energy / Telecom / Crypto Miners / Metal Miners / Healthcare / Consumer Staples / Utilities / REITs), so the sidebar reads as a mirror across regions. Plus structural splits — INDICES sub-sectored by region, FUTURES & FX split into COMMODITIES + FX, new BONDS & RATES + VIX & RISK top-levels — and a top-level WATCHLIST group seeded empty for personal additions.

---

## Goal

Replace the current "personal-flavored" seed with a structurally symmetric one that:

1. **Makes Pulse demonstrable.** Pulse needs ~150-200 rows with category variety. Current 97 rows skewed heavily into mega-cap US tech doesn't tell rich cross-section stories. Reformulated 199 rows across asset classes does.
2. **Mirrors US ↔ CA structure.** Sidebar reads as parallel branches per region. Sub-sectors at the same names on both sides → side-by-side breadth comparisons in Pulse.
3. **Carves out personal customization space.** Empty `WATCHLIST` top-level group signals to users (including future-you) that the seed is the floor, not the ceiling.
4. **Stays within free-tier budgets.** Yahoo + FRED only; no new fetcher dependencies. Initial fetch fits within the unofficial-Yahoo tolerance envelope (170 historical fetches in <3 minutes).

---

## Why a reformulation, not an extension

Two paths considered:

- **Extension:** keep the existing 72 tickers + add new sector groups alongside (US SECTORS + BONDS + COMMODITIES + FX + VIX). Less invasive but produces an inconsistent sidebar — US EQUITIES stays a flat mega-cap blob while a separate US SECTORS group has the breadth.
- **Reformulation:** restructure US EQUITIES into the same sub-sector tree as CA EQUITIES, splitting the existing mega-caps into Tech / Banking sub-sectors. Mirrors the regional structure cleanly. Pulse benefits more from parallel grouping than from a separate ETF-only sector.

User picked **reformulation** — symmetry across regions matters more than minimum-disruption.

Reformulation requires a **full database reset** at deploy time (not an `INSERT OR IGNORE` migration on top of the old DB). See "Pre-ship reset workflow" below for the procedure.

---

## Decision log (locked 2026-05-02)

Walked through 9 open questions during the design conversation. Decisions captured here as the canonical record.

| # | Question | Decision |
|---|---|---|
| 1 | Drop BRK-B from seed? | **YES.** Doesn't fit Tech / Banking / any other sub-sector cleanly. Conglomerate that resists categorization. User can re-add via Manage Watchlist if desired. |
| 2 | GLXY + WULF — keep in CA Crypto Miners or move to US? | **Move to US Crypto Miners.** Both are US-listed; geographic placement aligns with listing exchange. CA Crypto Miners shrinks to 3 (HUT.TO BITF.TO HIVE.TO). |
| 3 | Sub-sector CRYPTO or stay flat? | **Stay flat.** Crypto sub-categories shift faster than the seed; flat list is operationally simpler and Pulse handles flat groups fine. Drop USDT-USD + USDC-USD (stablecoins are permanent flat rows = Pulse noise). |
| 4 | VIX & RISK — top-level group or fold into INDICES? | **Top-level group.** ^VIX is a fear gauge, not an index. Separate slot reads better; user will glance at it daily. |
| 5 | Telecom asymmetry — pad US to 4 like CA, or accept 3? | **Accept asymmetry.** US has 3 majors (T VZ TMUS); CA has 4. Symmetry-by-construction shouldn't override genuine market structure. Same principle applies to Healthcare (CA = 2). |
| 6 | CA Tech tickers — 5 names enough? | **Yes — 5 is right.** SHOP.TO CSU.TO OTEX.TO KXS.TO DSG.TO. |
| 7 | Sub-sector COMMODITIES into Energy / Metals / Agriculturals? | **Yes.** Adds clarity, matches the FX-as-separate-group decision. |
| 8 | Sub-sector INDICES by region (Americas / Europe / Asia-Pacific)? | **Yes.** Pulse benefits — regional regime stories. |
| 9 | Add Healthcare / Consumer Staples / Utilities / REITs to BOTH regions? | **Yes.** Full mirror across the 10 standard equity sub-sectors. |

**Additional locked items from the rate-limit / DB-size / personalization conversation:**

| # | Question | Decision |
|---|---|---|
| 10 | Top-level `WATCHLIST` group seeded empty for personal additions? | **YES.** Sits at the top of user-managed sections (above INDICES). Pulse picks it up as its own section header. Tip in FeaturesTab points users at it. |
| 11 | Initial-prime burst risks Yahoo throttling? | **Mitigate via batched prime** — stages 30-50 tickers per batch with a small delay. Per-section manual prime button (extension of S9 Scanner PRIME pattern) as user-controllable fallback. |
| 12 | Migration vs full reset for the seed change? | **Full reset.** Reformulation drops + reorganizes too much for `INSERT OR IGNORE`-style migration. User backs up current DB, deletes/renames the file, reopens app — fresh seed runs. |

---

## Final sidebar structure

```
SCANNER          ← pinned
PULSE            ← pinned (new — see pulse_design.md)
ANALYSIS         ← pinned
MACRO            ← pinned (29 FRED series)
NEWS             ← pinned
─────────────
WATCHLIST                   ← empty by default; user adds personal picks
INDICES
  Americas
  Europe
  Asia-Pacific
US EQUITIES
  Tech
  Banking
  Energy
  Telecom
  Crypto Miners
  Metal Miners
  Healthcare
  Consumer Staples
  Utilities
  REITs
CA EQUITIES
  Tech
  Banking
  Energy
  Telecom
  Crypto Miners
  Metal Miners
  Healthcare
  Consumer Staples
  Utilities
  REITs
CRYPTO                      (flat, 14 names)
COMMODITIES
  Energy
  Metals
  Agriculturals
FX                          (flat, 6 names)
BONDS & RATES               (flat, 6 names)
VIX & RISK                  (flat, 1 name)
```

8 user-managed top-level groups + 5 pinned. WATCHLIST sits between the pinned-trio and the seeded-data groups so customization is visually first.

---

## Specific ticker populations

### INDICES — 15 (regrouped, no new tickers)

| Sub-sector | Tickers |
|---|---|
| Americas | `^GSPC` `^DJI` `^IXIC` `^RUT` `^GSPTSE` `^BVSP` |
| Europe | `^FTSE` `^GDAXI` `^FCHI` `^STOXX50E` |
| Asia-Pacific | `^N225` `^HSI` `000001.SS` `^AXJO` `^KS11` |

### US EQUITIES — 66 across 10 sub-sectors

| Sub-sector | Tickers | Count |
|---|---|---|
| Tech | `AAPL` `MSFT` `NVDA` `GOOGL` `AMZN` `META` `AVGO` `TSLA` | 8 |
| Banking | `JPM` `BAC` `WFC` `C` `GS` `MS` `USB` `PNC` | 8 |
| Energy | `XOM` `CVX` `COP` `EOG` `OXY` `MPC` `PSX` | 7 |
| Telecom | `T` `VZ` `TMUS` | 3 |
| Crypto Miners | `MARA` `RIOT` `CLSK` `CIFR` `CORZ` `GLXY` `WULF` | 7 |
| Metal Miners | `NEM` `FCX` `GOLD` `CCJ` `SCCO` `MOS` `AA` | 7 |
| Healthcare | `UNH` `JNJ` `LLY` `PFE` `ABBV` `MRK` `TMO` `ABT` | 8 |
| Consumer Staples | `PG` `WMT` `COST` `KO` `PEP` `MDLZ` `MO` | 7 |
| Utilities | `NEE` `DUK` `SO` `AEP` `D` `XEL` `EXC` | 7 |
| REITs | `AMT` `PLD` `EQIX` `CCI` `O` `SPG` `PSA` | 7 |

### CA EQUITIES — 52 across 10 sub-sectors

| Sub-sector | Tickers | Count |
|---|---|---|
| Tech | `SHOP.TO` `CSU.TO` `OTEX.TO` `KXS.TO` `DSG.TO` | 5 |
| Banking | `RY.TO` `TD.TO` `BNS.TO` `BMO.TO` `CM.TO` `NA.TO` | 6 |
| Energy | `CNQ.TO` `SU.TO` `ENB.TO` `TRP.TO` `CVE.TO` `IMO.TO` `TOU.TO` | 7 |
| Telecom | `BCE.TO` `T.TO` `RCI-B.TO` `QBR-B.TO` | 4 |
| Crypto Miners | `HUT.TO` `BITF.TO` `HIVE.TO` | 3 (GLXY/WULF moved to US) |
| Metal Miners | `ABX.TO` `AEM.TO` `FNV.TO` `K.TO` `WPM.TO` `TECK-B.TO` `FM.TO` `IVN.TO` `HBM.TO` | 9 |
| Healthcare | `BHC.TO` `GUD.TO` | 2 (CA healthcare is genuinely thin — accept asymmetry) |
| Consumer Staples | `L.TO` `ATD.TO` `EMP-A.TO` `MRU.TO` `WN.TO` `DOL.TO` | 6 |
| Utilities | `FTS.TO` `EMA.TO` `H.TO` `AQN.TO` `CPX.TO` `TA.TO` | 6 |
| REITs | `REI-UN.TO` `CAR-UN.TO` `HR-UN.TO` `AP-UN.TO` `GRT-UN.TO` `FCR-UN.TO` | 6 |

### CRYPTO — 14 (flat, no stablecoins)

`BTC-USD` `ETH-USD` `BNB-USD` `SOL-USD` `XRP-USD` `ADA-USD` `DOGE-USD` `TRX-USD` `LINK-USD` `AVAX-USD` `MATIC-USD` `DOT-USD` `ATOM-USD` `LTC-USD`

(Drop USDT-USD + USDC-USD per Decision #3.)

### COMMODITIES — 11 across 3 sub-sectors

| Sub-sector | Tickers | Count |
|---|---|---|
| Energy | `CL=F` `NG=F` `BZ=F` (Brent crude) | 3 |
| Metals | `GC=F` `SI=F` `HG=F` `PA=F` (palladium) `PL=F` (platinum) | 5 |
| Agriculturals | `ZC=F` (corn) `ZW=F` (wheat) `ZS=F` (soybeans) | 3 |

### FX — 6 (flat)

`DX-Y.NYB` `EURUSD=X` `GBPUSD=X` `USDJPY=X` `USDCAD=X` `AUDUSD=X`

### BONDS & RATES — 6 (flat)

`TLT` (long Treasury) · `IEF` (intermediate Treasury) · `SHY` (short Treasury) · `HYG` (high-yield credit) · `LQD` (investment-grade credit) · `TIP` (inflation-protected)

### VIX & RISK — 1 (flat)

`^VIX`

(MOVE = bond vol — desired but Yahoo coverage is unreliable. Skip for v1; revisit post-ship if Yahoo serves it cleanly.)

### WATCHLIST — empty by default

Top-level sector_group seeded with `enabled=1` but zero `watchlist_tickers` rows. User adds picks via Manage Watchlist; Pulse renders the section header even when empty (with a "Add tickers via Manage Watchlist" placeholder in the row area), giving the affordance maximum visibility.

---

## MACRO additions — 25 → 29 FRED series

Existing 25 (18 visible + 7 analysis-only) + 4 additions:

| Series | Description | Why |
|---|---|---|
| `M2SL` | M2 money stock (Monthly) | Broad liquidity gauge; complements rates dashboard |
| `DTWEXBGS` | Trade-Weighted Dollar Index — Broad (Daily) | Fundamentals view of DXY; longer-term framework reference |
| `BAMLH0A0HYM2` | ICE BofA US High Yield Index OAS (Daily) | Real risk-regime indicator; complements NFCI for credit-side stress |
| `DCOILWTICO` | Crude Oil Prices: WTI (Daily) | FRED-sourced WTI; deeper history than `CL=F` for macro back-testing |

All 4 default to `tile_visible=1` (added to MACRO dashboard). They're material enough to deserve tile real-estate.

---

## Scale check

| Group | Pre-reformulation | Post-reformulation | Δ |
|---|---|---|---|
| INDICES | 15 | 15 | 0 |
| US EQUITIES | 10 | 66 | +56 |
| CA EQUITIES | 31 | 52 | +21 |
| CRYPTO | 10 | 14 | +4 |
| COMMODITIES | (5 in old FUTURES & FX) | 11 | +6 |
| FX | (1 DXY in old FUTURES & FX) | 6 | +5 |
| BONDS & RATES | 0 | 6 | +6 |
| VIX & RISK | 0 | 1 | +1 |
| WATCHLIST | 0 | 0 (empty seeded group) | 0 |
| **Tickers total** | **72** | **170** | **+98** |
| MACRO (FRED) | 25 | 29 | +4 |
| **Pulse rows total** | **97** | **199** | **+102** |

199 rows lands at the upper end of the Pulse sweet spot (100-200). Section grouping makes it scannable. Beyond 200 we'd want section-collapse UI; at exactly 199 we're in the no-collapse-needed zone.

---

## Rate limit assessment

Yahoo Finance `/v8/chart` is the only fetcher under pressure. FRED is effectively unlimited; CoinGecko is not in the active fetcher path; news is small.

**Initial historical fetch (worst case):**
- 170 tickers × 1 historical call each (5y daily bars per response)
- Existing semaphore-capped concurrency at 5 in flight
- Estimated wall time: <1 minute

**Steady-state quote refresh:**
- 5-minute cadence during market hours
- 170 tickers / 300 seconds ≈ 0.57 req/sec sustained
- Trivial; well under any plausible Yahoo throttle

**Risk envelope:** LOW for normal user behavior. The unofficial Yahoo endpoint has gotten more aggressive about blocking automated access through 2024-2025. A 170-ticker first-install burst is bigger than the existing 72-ticker burst but still within "normal user opens an app" envelope.

**Mitigations baked in pre-ship:**
- Initial prime stages tickers in batches of 30-50 with a small delay between batches (extends existing prime path)
- Per-section "Prime this section" button (extension of S9 Scanner PRIME pattern) for user-controllable manual pacing if auto-prime ever throttles
- Existing semaphore concurrency cap stays at 5; do NOT bump higher

---

## Database size estimate

Per-row math (rough, includes WAL + index overhead):

- `price_history`: ~150 KB per ticker (5y daily bars + indexes). 170 tickers ≈ **25-30 MB**
- `fred_observations`: ~30 KB avg per series. 29 series ≈ **~1.5 MB**
- `quote_cache`: 170 rows × ~250 bytes ≈ **~50 KB** (negligible)
- `news_items`: 30-day TTL × 8 feeds × ~50 items/day × ~500 bytes ≈ **~6 MB**
- WAL + indexes overhead: ~40-50% of base ≈ **~15-18 MB**

**Estimated total post-expansion: 55-65 MB.** Under 100 MB by a comfortable margin. Should stay under 200 MB even with another year of bar accumulation.

For reference: current header reads ~38 MB at 72 tickers; the expansion projection scales roughly linearly with ticker count for the dominant cost component (`price_history`).

SQLite handles multi-GB databases without issue. Storage is not a constraint here — fetcher cadence is the real envelope.

---

## Pre-ship reset workflow

The reformulated seed drops + reorganizes too much to cleanly migrate via `INSERT OR IGNORE` on top of the old DB. User would end up with old US EQUITIES flat structure + new sub-sectored structure side-by-side, plus orphan rows from dropped tickers.

**Cleanest path: full reset.**

1. **Backup current DB** via Settings → Storage → Backup-copy (S10 feature). Saves the current state to a user-chosen location.
2. **Close the app.**
3. **Manually rename or delete** the current DB file at the path shown in the app header (typically `%APPDATA%/personal-terminal/`). The pointer file `db_location.txt` (S10) lives in the default data dir — leaving it untouched lets the app fall back to the default path on relaunch.
4. **Reopen the app** — `Db::seed()` runs the new reformulated seed against an empty DB. Initial Yahoo prime starts (170 tickers, ~1-3 minutes for the initial burst).
5. **Verify** all sectors populate; verify Pulse looks right; verify any custom additions from the old DB get re-added via Manage Watchlist.

A "Reset to factory" button could be added to Settings → Storage but isn't worth building for a one-time operation. Manual rename is fine.

**Rollback path:** if anything goes sideways, the backup from step 1 is a single file copy back into the data dir.

---

## Pre-seed ticker validation

Yahoo's symbol formats are mostly predictable, but some new additions need verification before committing the seed:

**Known-good (already in production seed or trivial format):**
- US tickers (no suffix): all the new US sub-sector additions
- TSX with `.TO` suffix: most CA additions match the existing pattern
- Crypto with `-USD` suffix: matches existing

**Worth checking pre-seed:**
- CA REIT format `-UN.TO` (REI-UN.TO, CAR-UN.TO, etc.) — non-standard suffix, verify Yahoo serves these
- CA dual-class shares (`-A.TO` / `-B.TO`) for new additions — `EMP-A.TO` (Empire Foods) added; format works for existing `RCI-B.TO` so should be fine
- FX pairs `=X` suffix (EURUSD=X etc.) — verify return format is consistent with existing `DX-Y.NYB`
- Brent crude `BZ=F` — verify it's the active continuous contract

Quick smoke test: fetch each new ticker once via the existing Yahoo client; log any 404s. Treat any failures as v1.2-1 follow-ups; ship v1.2 with a documented "these tickers didn't validate at seed time" list.

---

## Implementation phases

### Phase 0a — Pre-flight checks (separate task, ~1 hour)

- Validate the ~98 new ticker symbols against Yahoo's `/v8/chart` endpoint
- Confirm FRED accepts the 4 new series IDs
- Document any invalid symbols + replacements

### Phase 0b — Seed rewrite (single commit, ~2-3 hours)

- Rewrite `src-tauri/src/db/seed.sql`:
  - New `sector_groups` rows for INDICES sub-sectors, US EQUITIES sub-sectors, CA EQUITIES sub-sectors (incl. new ones), COMMODITIES sub-sectors, FX, BONDS & RATES, VIX & RISK, WATCHLIST
  - Reorganize `watchlist_tickers` rows: existing CA EQUITIES intact (with one new Tech sub-sector), existing US EQUITIES split into Tech / Banking, all new tickers added with appropriate `sector_group_id`
  - Drop USDT-USD + USDC-USD + BRK-B from the seed
  - Move GLXY + WULF rows from `ca_crypto_miners` to `us_crypto_miners`
  - Add 4 new FRED series rows (M2SL, DTWEXBGS, BAMLH0A0HYM2, DCOILWTICO) with `tile_visible=1`
- Update `display_order` on existing groups to fit the new layout

### Phase 0c — Documentation (same commit)

- Update `DESIGN.md` "Ticker Inventory" section to reflect the reformulated seed
- Add `WATCHLIST` group note to FeaturesTab Tips ("Add your own tickers via Manage Watchlist; they appear in your WATCHLIST section")
- Add Tip about the reset workflow to FeaturesTab if relevant

### Phase 0d — Optional batched-prime extension (separate commit, ~1 hour)

- Extend the existing prime path to stage in batches of 30-50 with a small inter-batch delay
- Add per-section "Prime this section" button to the sidebar context menu (or to ManageWatchlistModal) — leverages the existing `prime_scanner_histories` infrastructure pattern from S9

### Phase 0e — Smoke test + ship

- Backup own DB
- Trigger reset workflow
- Smoke-test: each sector group populates, FRED dashboard renders, Analysis tabs work, no orphan groups
- Verify the WATCHLIST section header renders empty without breaking the sidebar layout
- Commit + merge to master

---

## File touch-list

**Modified (Rust):**
- `src-tauri/src/db/seed.sql` — bulk rewrite (the meat of the change)
- `src-tauri/src/sources/yahoo.rs` — optional batched-prime extension (Phase 0d)

**Modified (Frontend):**
- `src/components/Sidebar.tsx` — verify rendering with the new sector_group tree (likely no changes — existing tree handles arbitrary depth)
- `src/components/settings/FeaturesTab.tsx` — Tip additions for WATCHLIST + reset workflow
- `src/components/manage-watchlist/*` — optional per-section "Prime this section" button (Phase 0d)

**Modified (Docs):**
- `.projects/01_initial_design/DESIGN.md` — update Ticker Inventory section
- `.projects/00_tracking/PROGRESS.md` — Phase 0 session entry on ship
- `.projects/00_tracking/memory/MEMORY.md` — note the reformulated seed

---

## Risks

- **Yahoo throttling on initial burst.** Mitigation: batched-prime + per-section manual prime. If Yahoo tightens further, fall back to manual prime per group.
- **Some new tickers may fail Yahoo validation.** Mitigation: pre-seed validation pass (Phase 0a). Document failures; ship v1.2 with known gaps.
- **User loses custom additions during the reset.** Mitigation: explicit backup step in the reset workflow + Tip in docs about re-adding custom tickers post-reset.
- **CA Healthcare and US Telecom appear "broken" with only 2-3 tickers.** Mitigation: accept the asymmetry. The Pulse heatmap shows what's there; thin sub-sectors are an accurate picture of the market structure, not a bug.
- **Sidebar height grows substantially.** With 10 US sub-sectors + 10 CA sub-sectors + 3 INDICES regions + 3 COMMODITIES sub-sectors, the tree gets tall. Existing collapse / expand state handles this; default-collapsed-but-rememberable behavior keeps it manageable.

---

## Open questions remaining

These don't block the seed-rewrite work but should be noted before the actual implementation session:

1. **Display order within each sub-sector** — alphabetical, market-cap descending, or curated? My lean: market-cap descending (matches what most traders naturally read). Alphabetical is the safe default if no clear preference.
2. **Sub-sector display order within each parent** — alphabetical (current CA EQUITIES is roughly so), by sector size, or by your-preference? Current CA EQUITIES uses domain-relevant ordering (Energy first since it's a Canadian flagship sector). Apply the same logic to US EQUITIES?
3. **Inactive ticker grace period** — if Yahoo returns a 404 on a seeded ticker, what's the UX? Current behavior is to leave the row but show empty data. Acceptable for v1.2; revisit if it becomes annoying.
4. **MOVE bond-vol ticker** — desired for VIX & RISK group. Yahoo coverage is unreliable. Decision: ship v1.2 without MOVE; add post-ship if Yahoo serves it cleanly via a one-line seed addition.

---

## What this *isn't* doing

- Not adding new fetchers (CoinGecko deferred from S6 stays deferred; news feeds unchanged; no new APIs)
- Not changing the schema (just rows in existing tables)
- Not adding indicator framework changes
- Not adding new Analysis tabs (Pulse is the next feature, separate doc)
- Not adding fundamentals (P/E, EPS, etc.) — out of free-tier scope

---

## Status

- Design locked: 2026-05-02 (database expansion conversation)
- Implementation: pending — single seed-rewrite commit + optional batched-prime commit
- Target: ship before Pulse implementation begins
- Pre-ship requirement: ticker validation pass (Phase 0a)
