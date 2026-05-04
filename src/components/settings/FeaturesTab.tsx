export default function FeaturesTab() {
  return (
    <div className="settings-section">
      <p className="settings-section__intro">
        Quick reference for what's in the app and where to find it.
      </p>

      <div className="settings-subhead">Chart overlays &amp; subpanes</div>

      <div className="about-card">
        <div className="about-card__title">Volume Profile (VRVP)</div>
        <p className="about-card__body">
          <strong>What:</strong> Horizontal histogram of total trading volume
          at each price level across the visible time window. Drawn as a
          translucent overlay on the right ~18% of the price pane.
        </p>
        <p className="about-card__body">
          <strong>POC:</strong> The Point of Control — the price bin with the
          highest total volume — is highlighted in yellow. Often acts as
          future support or resistance.
        </p>
        <p className="about-card__body">
          <strong>Where:</strong> <span className="about-tips__key">VRVP</span>{' '}
          toggle in the feature-chart toolbar; state persists across sessions.
        </p>
        <p className="about-card__body">
          <strong>Caveat:</strong> Auto-suppressed when the visible window has
          no volume data (FX / DXY).
        </p>
      </div>

      <div className="about-card">
        <div className="about-card__title">Volume pane</div>
        <p className="about-card__body">
          <strong>What:</strong> Bar pane below the price chart showing per-bar
          volume. Bars are coloured green when the close ≥ open, red when the
          close &lt; open.
        </p>
        <p className="about-card__body">
          <strong>Where:</strong> <span className="about-tips__key">VOL</span>{' '}
          toggle in the feature-chart toolbar. Toggling off hands the freed
          space to the price pane.
        </p>
      </div>

      <div className="about-card">
        <div className="about-card__title">Drawdown subpane</div>
        <p className="about-card__body">
          <strong>What:</strong> Filled-area subpane below the price showing
          the % decline from each prior peak. Anchored at 0% on top; the floor
          reads the deepest drawdown in the visible window.
        </p>
        <p className="about-card__body">
          <strong>How to read:</strong> A long flat red region is a sustained
          drawdown the asset hasn't recovered from. Sharp dips that snap back
          to 0% mark recoveries to new highs.
        </p>
        <p className="about-card__body">
          <strong>Where:</strong> <span className="about-tips__key">DD</span>{' '}
          toggle in the feature-chart toolbar; default off, persists.
        </p>
      </div>

      <div className="about-card">
        <div className="about-card__title">Auto-fit Y axis</div>
        <p className="about-card__body">
          <strong>What:</strong> Tightens the price-pane Y bounds to the
          visible-window high/low with 3% headroom, so zoomed-in views read at
          full pane height instead of being squashed by far-away extremes.
        </p>
        <p className="about-card__body">
          <strong>Where:</strong>{' '}
          <span className="about-tips__key">AUTO Y</span> toggle in the
          feature-chart toolbar. Default on. RSI subpane stays pinned to
          [0, 100] regardless of this setting.
        </p>
      </div>

      <div className="about-card">
        <div className="about-card__title">Linked cursor across charts</div>
        <p className="about-card__body">
          <strong>What:</strong> Crosshair position is shared across all open
          feature charts in the same group. Hovering one chart moves the
          crosshair on every other chart at the same x-position.
        </p>
        <p className="about-card__body">
          <strong>Where:</strong> Always on; no toggle. Useful when the
          multi-ticker overlay (M9) and side-by-side comparisons land.
        </p>
      </div>

      <div className="about-card">
        <div className="about-card__title">PNG save</div>
        <p className="about-card__body">
          <strong>What:</strong> One-click PNG export of the current chart at
          2× pixel ratio with the dark-theme background baked in. Filename
          includes the chart title and today's date.
        </p>
        <p className="about-card__body">
          <strong>Where:</strong> <span className="about-tips__key">PNG</span>{' '}
          button in the feature-chart toolbar. Saves to the system Downloads
          folder.
        </p>
      </div>

      <div className="settings-subhead">Indicators</div>

      <div className="about-card">
        <div className="about-card__title">Indicator framework</div>
        <p className="about-card__body">
          Indicators are universally available on every feature chart and
          toggleable per-ticker. New indicators can be added by implementing a
          small Rust trait — the chart code is indicator-agnostic.
        </p>
      </div>

      <div className="about-card">
        <div className="about-card__title">SMMA Ribbon</div>
        <p className="about-card__body">
          <strong>What:</strong> Four smoothed moving averages on (high + low)
          / 2, lengths 15 / 19 / 25 / 29. Their ordering classifies market
          regime as bull, bear, or neutral; a 3-bar confirmation filter
          suppresses whipsaws. The state-coloured envelope between the outer
          SMMAs visualizes regime; flip markers note regime transitions.
        </p>
        <p className="about-card__body">
          <strong>Origin:</strong> Math derived from Bill Williams' Alligator
          indicator (<em>Trading Chaos</em>, 1995), extended from three lines
          to four. The SMMA primitive itself is Welles Wilder's RMA
          (<em>New Concepts in Technical Trading Systems</em>, 1978).
        </p>
        <p className="about-card__body">
          <strong>Where:</strong> Indicator chip on every feature chart.
          Default off per ticker.
        </p>
        <p className="about-card__body">
          <strong>Tip:</strong> Click <em>Base</em> in the chart legend (with{' '}
          <span className="about-tips__key">AUTO Y</span> off) to drop the
          bands to the x-axis and see the state-coloured hills / valleys laid
          out independent of price.
        </p>
        <p className="about-card__body">
          <strong>Caveat:</strong> Most useful on tech equities and
          cryptocurrencies on 4-hour through monthly timeframes. Not designed
          for commodities, FX, or intraday HFT.
        </p>
        <p className="about-card__body">
          <strong>Liability:</strong> Decision support, not investment advice.
        </p>
      </div>

      <div className="about-card">
        <div className="about-card__title">RSI (14) and ATR (14)</div>
        <p className="about-card__body">
          Both ported verbatim from Welles Wilder's{' '}
          <em>New Concepts in Technical Trading Systems</em> (1978). RSI shows
          momentum on a 0–100 scale with 70 / 30 reference lines; ATR shows
          volatility in price units.
        </p>
      </div>

      <div className="settings-subhead">Analysis section</div>

      <div className="about-card">
        <div className="about-card__title">Overview &amp; "How to read this" pattern</div>
        <p className="about-card__body">
          Cross-asset and macro tools that answer questions about how
          things relate or what regime we're in — distinct from the
          per-ticker FeatureChart. Tabs are registry-driven; new tools land
          as a Rust compute module + a React tab without touching shared code.
        </p>
        <p className="about-card__body">
          Every Analysis tab opens with a one-sentence subtitle plus two
          collapsible disclosures: <em>How to read this</em> (interpretation
          guide) and <em>The math</em> (formula reference for power users).
          The same liability framing as v1's indicators applies — decision
          support, not investment advice.
        </p>
      </div>

      <div className="about-card">
        <div className="about-card__title">Correlations</div>
        <p className="about-card__body">
          Pearson correlation matrix on log returns over a configurable
          lookback (30 / 60 / 90 / 180 / 365 days). HTML grid heatmap, not
          ECharts — diagonal pinned to 1.0. Click any non-diagonal cell to
          jump to the Pairs tab pre-loaded with that pair.
        </p>
      </div>

      <div className="about-card">
        <div className="about-card__title">Yield Curve</div>
        <p className="about-card__body">
          Dual-pane: term structure (3M / 2Y / 5Y / 10Y / 30Y, latest +
          6-months-ago + 5-years-ago snapshots) above a spread series over
          time (2s10s default, 3m10y selectable) with NBER recession bars
          overlaid.
        </p>
      </div>

      <div className="about-card">
        <div className="about-card__title">Pairs / Ratio</div>
        <p className="about-card__body">
          Plots <code>numerator / denominator</code> over time with a rolling
          z-score subpane (±2σ bands). Quick-pick presets for common pairs
          (BTC/ETH, GC/SI, HG/GC, IXIC/GSPC) editable via the registry.
        </p>
      </div>

      <div className="about-card">
        <div className="about-card__title">RRG (Relative Rotation Graph)</div>
        <p className="about-card__body">
          Four-quadrant scatter showing how each ticker is performing against
          a benchmark and whether that performance is improving or weakening.
          Weekly resampled, RS-Ratio + RS-Momentum anchored at 100. Tail
          length picker (4 / 8 / 12 weeks); benchmark switch via Apply button
          (re-normalization is too costly for live keystrokes).
        </p>
      </div>

      <div className="about-card">
        <div className="about-card__title">Recession Probability</div>
        <p className="about-card__body">
          NY Fed's modeled probability of a US recession in the next 12 months
          (FRED <code>RECPROUSM156N</code>), with the conventional 30% (warn)
          and 50% (imminent) reference lines plus NBER recession bars.
        </p>
      </div>

      <div className="about-card">
        <div className="about-card__title">Financial Conditions Index</div>
        <p className="about-card__body">
          Chicago Fed weekly NFCI (FRED <code>NFCI</code>). Above the zero
          baseline = tighter than the long-run average; below = looser. NBER
          recession bars overlaid for context.
        </p>
      </div>

      <div className="about-card">
        <div className="about-card__title">Regime Quadrant</div>
        <p className="about-card__body">
          Four-quadrant scatter of growth (FRED <code>INDPRO</code> YoY) vs
          inflation (CPI YoY default; Core PCE toggle). 12 / 24 / 36 / 48
          month trail with the head dot labelled. Crosshairs anchored at the
          long-run mean of each series so the quadrants represent
          above-trend vs below-trend (Reflation / Goldilocks / Disinflation /
          Stagflation), not absolute levels.
        </p>
      </div>

      <div className="about-card">
        <div className="about-card__title">NBER recession bar overlay</div>
        <p className="about-card__body">
          Faint gray vertical bands marking US recessions per the National
          Bureau of Economic Research's official dating. Sourced from FRED{' '}
          <code>USREC</code>; rendered on Yield Curve, Recession Probability,
          and Financial Conditions tabs via a shared one-fetch-per-session
          hook.
        </p>
      </div>

      <div className="settings-subhead">Dashboard &amp; layout</div>

      <div className="about-card">
        <div className="about-card__title">Pulse</div>
        <p className="about-card__body">
          <strong>What:</strong> Single-screen percentile-rank cross-section of
          every ticker and macro series in your universe — REGIME / AGE /
          LEVEL / RSI / ATR / VOL / DD. Each cell answers "where is this today
          vs the last 5 years of its own history?"
        </p>
        <p className="about-card__body">
          <strong>Where:</strong> PULSE is pinned at the top of the sidebar.
          Click a ticker to jump straight to its feature chart; sort any of
          the percentile columns to surface extremes.
        </p>
        <p className="about-card__body">
          <strong>PRIME chip:</strong> Surfaces in the Pulse banner only when
          some rows are missing history. One-click batch-fetch of historical
          bars; failures (typically wrong exchange suffix) are listed inline
          below the banner.
        </p>
      </div>

      <div className="about-card">
        <div className="about-card__title">
          Tile range switch (1D / 1W / 1M / YTD / 1Y)
        </div>
        <p className="about-card__body">
          Pill row above ticker grids selects the lookback window. Heatmap
          thresholds scale per range so wide windows don't paint everything
          uniformly red or green. Selection persists.
        </p>
      </div>

      <div className="settings-subhead">Tips &amp; hidden shortcuts</div>
      <ul className="about-tips">
        <li>
          <span className="about-tips__key">Ctrl + right-click</span> on any
          feature chart toggles the hover tooltip while keeping the crosshair
          visible.
        </li>
        <li>
          <span className="about-tips__key">Manage Watchlist</span> in the
          sidebar opens a 3-tab modal for editing tickers, sector groups, and
          news feeds in one place.
        </li>
        <li>
          <span className="about-tips__key">Click a Correlations cell</span>{' '}
          to jump to the Pairs tab pre-loaded with that pair as numerator /
          denominator — for a deeper look at the relationship.
        </li>
        <li>
          <span className="about-tips__key">WATCHLIST</span> at the top of the
          sidebar is empty by default — a personal-additions slot. Add your
          own tickers via Manage Watchlist and they'll appear there; create
          additional custom sector groups for further organization.
        </li>
        <li>
          <span className="about-tips__key">Reset to a fresh seed</span>:
          back up your database first via Settings → Storage → Backup, close
          the app, then rename or delete the database file at the path shown
          in the header. Reopening the app rebuilds against the current seed.
          Useful after a major upgrade or when starting over.
        </li>
      </ul>
    </div>
  );
}
