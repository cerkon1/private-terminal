# S13 — Manage Watchlist refactor + reparenting + version bump + RC.1 ship (2026-04-26)

Major UX consolidation + last v1 release blocker cleared + first cold-eye RC ship.

---

## Manage Watchlist modal — Option B (single-pane)

**Decision:** consolidate sidebar `Manage Groups` button + dashboard inline `EDIT` toggle into one bottom-of-sidebar `Manage Watchlist` button opening a 3-tab modal (`Tickers / Groups / News Feeds`). Default tab Tickers; last-selected ticker group persisted at `session.manage_watchlist_group`.

**Why Option B (single-pane with group dropdown) over Option A (two-pane)**:
- Groups tab and News Feeds tab are full-width single-pane tables; A would have made Tickers asymmetric.
- Move-to dropdown means cross-group ticker reorganization rarely requires *landing* on the destination group — moves originate from the source group's row.
- Keeps modal at default `modal` 900px width (no need for the wider `modal--wide` 720px or a custom larger size).
- One additional click per group switch is the only cost — small for an occasional task.

**Files:**
- New: `src/components/ManageWatchlistModal.tsx`
- Deleted: `src/components/GroupsManagerModal.tsx` (fully superseded)
- Modified: `Sidebar.tsx`, `App.tsx`, `TickerDashboard.tsx`, `SettingsModal.tsx`, `TickerEditPanel.tsx`, `app.css`

---

## Group reparenting

**Capability:** any user-managed top-level group can be moved under another top-level group; any child can be moved to top-level or to a different parent. Reparent dropdown per group row in Groups tab.

**Backend signature change** (`update_sector_group` in `edit_cmds.rs`):
```rust
pub struct UpdateSectorGroupInput {
    pub id: String,
    pub display_name: Option<String>,
    pub display_order: Option<i64>,
    pub enabled: Option<bool>,
    #[serde(default, deserialize_with = "deserialize_some")]
    pub new_parent_id: Option<Option<String>>, // tri-state, see LESSONS IPC-4
}
```

**Hard constraints (server-enforced):**
1. **2-level cap** — target parent must itself be top-level (`SELECT parent_id FROM sector_groups WHERE id = ? AND user_hidden = 0` checks `IS NULL`). Rejects moving X under a child.
2. **No own-children** — group with visible children rejected from non-null reparent (children would land at depth 3).
3. **No self-reference** — id == new_parent_id rejected.

**SQL update gate:** COALESCE can't distinguish "leave alone" from "set to NULL"; uses `parent_id = CASE WHEN ?5 = 1 THEN ?6 ELSE parent_id END` with `apply_parent: i64` flag column.

**No schema migration:** `sector_groups.parent_id` column existed since M1. Reparenting is runtime-only.

---

## 2-level cap as architectural constraint

Hard cap chosen over unlimited nesting because:
- Every realistic mental model for sectors fits in 2 levels (region → country, asset-class → instrument).
- Sidebar tree currently renders exactly 2 levels (top + child) — unlimited would force a recursive sidebar refactor.
- Pathological depth invites bad trees with no user benefit.

When reparenting hits the constraint, server returns the specific error message (`"target group 'X' is itself a sub-group; nesting is capped at 2 levels"` or `"group 'X' has N child group(s); move or delete them before reparenting"`); frontend displays it as-is.

---

## CoinGecko split — NEW_GROUP_SOURCES vs EDITABLE_SOURCE_SET

**Problem:** Add-form source dropdown was offering `coingecko` even though no CoinGecko fetcher exists today (CRYPTO group is labelled `coingecko` in DB but routes via Yahoo per M5). Tester would have hit this.

**Resolution:** two-constant split in `ManageWatchlistModal.tsx`:
```ts
const NEW_GROUP_SOURCES = ['yahoo'];                           // Add form options
const EDITABLE_SOURCE_SET = new Set(['yahoo', 'coingecko']);  // Visibility filter
```

**Effect:** existing CRYPTO group still appears in Groups table + Tickers picker (visibility = both); new groups can only be created with Yahoo (offered = only yahoo). When CoinGecko fetcher lands in v1.1, append `'coingecko'` to NEW_GROUP_SOURCES — no other change needed.

---

## Stacked-buttons table-layout fix

**Symptom:** Original `GroupsManagerModal` rendered each action button (↑↓×) in its own separate `<td className="edit-panel__cell-actions">`. Screenshot showed all three buttons stacked vertically per row, inflating row height ~3x.

**Cause:** `.edit-panel__cell-actions` has `display: flex` (CSS line 1093). Chromium/WebView2 takes table cells with `display: flex` out of normal table-row layout when there are *multiple sibling* such cells. Single cell is fine; siblings stack.

**Fix:** consolidate all three buttons into ONE `<td>`. Same pattern as `TickerEditPanel.tsx:353-370` (which has × + 🗑 in one cell).

**Rule:** `display: flex` on `<td>` is safe only when one cell per row has it. If multiple action cells in the same row need flex, use a single `<td>` with a flex `<div>` inside, or consolidate the cells.

---

## Sidebar pinned trio + separator

`SCANNER`, `MACRO`, `NEWS` pinned at top via hardcoded `PINNED_IDS` array in `Sidebar.tsx`. Order is array order, not `display_order`. New `<hr className="sidebar__separator">` between pinned and user-managed roots (only rendered when both sets non-empty). User-managed roots sorted by `displayOrder`.

These three are infrastructure: SCANNER is virtual (no tickers), MACRO uses `fred_series` (different data path), NEWS uses `news_feeds` + `news_items`. Editing them via Manage Watchlist makes no sense — they ship as-is.

---

## About-tab PrivateACB copy rewrite (last v1 release blocker)

**Problem:** Old copy described PrivateACB as "Adjusted Cost Base calculator for Canadian investors" with equity-style terminology ("splits, transfers, corporate actions"). Wrong on three specifics:
1. PrivateACB is **crypto**-specific, not generic equity ACB.
2. Four jurisdictions (CA, US, AU, UK), not just Canada.
3. Crypto doesn't have "splits / corporate actions" in the equity sense.

**Source:** `WebFetch` on `https://privateacb.com` returned 403 (bot-blocking). Pivoted to local `E:\Users\PBL\Documents\Dev\PrivateACB_Tauri\CLAUDE.md` which has canonical product description.

**New copy** (in `AboutTab.tsx`):
> "Private Terminal was built alongside **PrivateACB** — a desktop crypto tax calculator for Canada, the US, Australia, and the UK. It imports transactions from major exchanges, applies the cost-base method your jurisdiction expects, and produces the reports your accountant needs at year-end. Same privacy-first, single-machine philosophy as this app."

**Deliberate omissions:**
- Specific exchange names (decay risk; PrivateACB has 10+ Oracle profiles, list will change).
- Specific cost-base methods (varies per jurisdiction: CA = ACB, US = FIFO/LIFO/HIFO, UK = section-104 pooling, AU = FIFO + CGT discount).
- Pricing (PrivateACB is paid; not Private Terminal's job to advertise).
- Version / feature counts (decay).

---

## Version 0.1.0 → 1.0.0-rc.1

**Bumped in 4 files** (was incorrectly documented as 3 in S12):
1. `package.json`
2. `src-tauri/Cargo.toml`
3. `src-tauri/tauri.conf.json` ← **wins over Cargo.toml for Tauri v2 bundle metadata**
4. `src/version.ts`

`version.ts` comment was wrong (listed only `package.json` + `Cargo.toml`). Corrected to list all four with note about precedence.

**RC.1 framing:** honest "release candidate" — feature-complete, awaiting cold-eye verification, not committing to "shipped" yet. Cargo accepts `-rc.1` semver pre-release suffix without flags. Semver order: `0.9.0 < 1.0.0-rc.1 < 1.0.0-rc.2 < 1.0.0`.

---

## RC.1 distribution shape

- **Production exe:** `target/release/personal-terminal.exe` (19.8 MB; ~58s release build).
- **README.md** at project root — first-time README on this project. Tester-targeted: SmartScreen workaround (3-step), FRED-key signup walkthrough (90s), first-run expectation table (what works without keys, what doesn't), quick orientation, known limitations, feedback request framing (discoverability > bug-listing), DB location + clean uninstall path.
- **Staging dir:** `release/private-terminal-v1.0.0-rc.1/` (exe + README, 19.8 MB).
- **Distribution zip:** `release/private-terminal-v1.0.0-rc.1.zip` (8.1 MB compressed). Built via PowerShell `Compress-Archive`.

Uploaded to Google Drive by user. Tester is "computer nerd" so Drive scan-warning mitigation skipped (would otherwise share exe + README as loose files in a Drive folder rather than zipped).

---

## Review fixes folded in

- **`leafIds` → `parentIdsWithChildren`** in `TickerEditPanel.tsx`. Variable was misnamed — it stores *parent ids that have children*, not leaf ids.
- **Symbol immutability tooltip** on the static cell: `"Ticker symbol can't be edited — purge and re-add to change it"`.
- **CCY immutability tooltip**: `"Currency can't be edited after add — purge and re-add to change it"`.
- **Boundary ↑/↓ disabled** instead of silent no-op. New CSS: `.edit-panel__delete:disabled` (opacity 0.3, `cursor: default`).
- **Group reparent dropdown** excludes self; shows `— top level —` + every other top-level ticker-source group.

---

## Course corrections

- **Two-pane → single-pane.** Initial sketch had Option A (two-pane, group list left). User flagged consistency concern with Groups + News Feeds tabs (both single-pane). Locked Option B mid-design.
- **NEWS sidebar position.** First proposal had it solo at bottom. User chose to group with SCANNER/MACRO under one separator at top — same infrastructure mental category.
- **CoinGecko caveat caught late.** User spotted the hole before zip ship; would have surfaced as broken add-flow for tester. Two-constant split is the clean handle.
- **Version "seems wrong"** was the obvious read — app at v1-blocker-pass-complete with `0.1.0` was symptom of never bumping. Tagged `1.0.0-rc.1` for honest framing.

---

## Carry-over for next session

When tester feedback lands:
1. Triage into bugs / polish / discoverability / out-of-scope.
2. Fix bugs first; judge polish; copy-tweak discoverability if possible.
3. Once feedback exhausted: bump 4 files `1.0.0-rc.1` → `1.0.0`, rebuild, ship final.
4. Out-of-scope items file under `PROGRESS.md` → Discovered for v1.1 priority queue (existing: CoinGecko fetcher, bull/bear VRVP split, log mode Path A, M9 features, code signing).
