# Private Terminal — v1.0.0-rc.1

A personal Bloomberg-style desktop research dashboard. Free, local, no
account, no cloud, no telemetry.

This is a **release candidate** — the feature set is complete and the
intent is to ship `1.0.0` once cold-eye testers (you) confirm nothing
is obviously broken.

---

## 1. Get it running (3 steps)

### Step 1 — Launch the exe

Double-click `personal-terminal.exe`.

**Expect a SmartScreen warning the first time.** The app isn't
code-signed yet (signing certs are a planned cost, not a v1.0 blocker),
so Windows shows a blue dialog:

> *Microsoft Defender SmartScreen prevented an unrecognized app from
> starting. Running this app might put your PC at risk.*

To run it:

1. Click **More info**
2. Click **Run anyway**

Windows remembers this choice — you'll only see the dialog on the first
launch (or after a re-download).

If your antivirus quarantines the exe, that's a false positive — same
Tauri build stack as the maker's other product (PrivateACB) and the
same flag categories occasionally hit it. Whitelist or restore from
quarantine; let me know if it happens so I can track which AVs are
flagging.

### Step 2 — Add a FRED API key (90 seconds, free)

Without this, the **MACRO** section's 18 economic-indicator tiles will
sit empty. Every other section works without any key.

1. Go to <https://fred.stlouisfed.org/docs/api/api_key.html>
2. Click **Request or view your API key**, sign up (email + password),
   verify email, copy the key.
3. In Private Terminal: click the ⚙ icon (top-right) → **API Keys**
   tab → paste into the FRED row → **SAVE**.
4. Switch to the MACRO section in the sidebar. Tiles populate within a
   few seconds.

### Step 3 — (optional) Add a Finnhub API key

Only needed if you want US ticker news. Same drill: free signup at
<https://finnhub.io/>, paste the key in Settings → API Keys.

Without it, the **NEWS** section still works — 8 RSS feeds (BBC,
CNBC, Financial Post, Fed press, etc.) populate on a 30-min cadence.

---

## 2. First-run expectations

| What | When you'll see it |
|---|---|
| **Sidebar with all sections** | Immediately. SCANNER / MACRO / NEWS pinned at top; INDICES, CRYPTO, US/CA EQUITIES, FUTURES & FX below the divider. |
| **Yahoo-source tiles** (INDICES, CRYPTO, EQUITIES, FUTURES) | Populate within 1–3 seconds of clicking the section. No key required. |
| **MACRO tiles** | **Empty until FRED key added.** Add the key → tiles populate within seconds. |
| **News articles** | RSS feeds fetch on a 30-min schedule. First session may have no items in NEWS for up to half an hour. |
| **Charts on tile click** | Click any ticker tile → feature chart with candlesticks, volume, optional indicators (SMMA Ribbon, RSI, ATR), volume profile (VRVP). History fetches on demand the first time. |

---

## 3. Quick orientation

Things worth knowing without a manual:

- **Sidebar bottom — "Manage Watchlist"**: add/rename/move/delete tickers, groups, news feeds. Three tabs, one button.
- **Tile click → feature chart**: candlesticks + indicator panel. Scroll/drag the bottom slider to zoom history.
- **Indicator chips**: each chart has SMMA RIBBON / RSI / ATR toggles. OFF by default per ticker; click to enable.
- **AUTO Y / VOL / VRVP toggles** in the chart toolbar: y-axis auto-fit, volume pane, volume profile overlay.
- **Range switch** (1D/1W/1M/YTD/1Y) on dashboards: changes the % delta the tile heatmap is computed against.
- **HEATMAP toggle**: replace numeric values with green/red colour-coding per tile.
- **REFRESH**: forces a re-fetch for the current section. Otherwise data updates on a per-source cadence (5 min / 15 min / etc.).

---

## 4. Known limitations / things that aren't in this build

- **No installer** — portable exe only. No Start Menu entry, no
  Add/Remove Programs row. To "uninstall," delete the exe + the
  `%APPDATA%\Roaming\personal-terminal\` folder (see §6 below).
- **No code signing** — hence the SmartScreen warning. On the v1.x
  roadmap.
- **No auto-update** — when v1.0.x or v1.1.0 ships, you re-download the
  exe and replace the old one. Your database persists.
- **Crypto data via Yahoo, not CoinGecko** — the CRYPTO tickers
  (BTC-USD, ETH-USD, etc.) route through Yahoo Finance. CoinGecko
  integration is on the v1.1 roadmap.
- **Log-scale Y axis** on price charts — attempted in v0.10, dropped
  for v1.0 due to ECharts' base-10-tick limitation. Linear only for
  now.
- **Single-machine, single-user** — no accounts, no cloud, no shared
  watchlists. By design.

---

## 5. What feedback would be most useful

Cold-eye reviews are most useful for **discoverability and expectation
mismatch** — bugs are useful too, but secondary.

Ideal feedback bullets, in priority order:

1. **What's confusing?** Labels you don't understand, controls you
   can't find, sections that look broken when they're actually empty
   on purpose (FRED-without-key, NEWS pre-fetch).
2. **What surprised you?** Both negatively ("I clicked X expecting Y
   and got Z") and positively ("oh, that's neat").
3. **What did you try to do that you couldn't?** Missing affordances —
   things that *should* be possible but aren't obvious.
4. **What broke?** Visual glitches, console errors (Ctrl+Shift+I →
   Console tab), data that's wrong vs. another source.
5. **Performance.** Anything feel laggy or unresponsive on your machine?

A short note like *"I clicked Manage Watchlist and didn't realize the
tabs at the top were clickable for 30 seconds"* is more useful than a
long bug list.

---

## 6. Where data lives, and how to clean up

**Database file:**
`%APPDATA%\Roaming\personal-terminal\personal-terminal.db`

The header in the app shows the exact path; click it to copy.

The folder also contains:
- `personal-terminal.db-wal` and `-shm` — SQLite WAL files (transient,
  recreated on launch)
- `db_location.txt` — only present if you've used Settings → Storage →
  Change Location to move the DB elsewhere

**To uninstall cleanly:**
1. Close the app.
2. Delete `personal-terminal.exe` (wherever you saved it).
3. Delete the `%APPDATA%\Roaming\personal-terminal\` folder.

Done. No registry keys, no scheduled tasks, no leftover services.

---

## 7. Sending feedback

DM, email, screenshot, voice memo — whatever's easiest for you. No
formal bug-tracker setup yet; this is a friends-and-family RC.

Thanks for testing.
