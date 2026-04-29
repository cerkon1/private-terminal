export default function FeaturesTab() {
  return (
    <div className="settings-section">
      <p className="settings-section__intro">
        Quick reference for what's in the app and where to find it.
      </p>

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

      <div className="about-card">
        <div className="about-card__title">Scanner</div>
        <p className="about-card__body">
          Cross-watchlist sortable view of every ticker's current SMMA Ribbon
          state, latest price, RSI, and ATR. Click a column header to sort.
        </p>
        <p className="about-card__body">
          <strong>PRIME button:</strong> One-click batch-fetch of historical
          bars for any tickers missing them — needed before the indicator
          engine can compute a state.
        </p>
      </div>

      <div className="about-card">
        <div className="about-card__title">Market-hours strip</div>
        <p className="about-card__body">
          Top-of-window strip showing eight major exchanges (NYSE / TSX / LSE
          / TYO / HKG / SSE / ASX / KRX). Each chip is tied to its main index
          — outline color (green / red) reflects direction since last close,
          and a cyan dot indicates the exchange is currently open.
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

      <div className="about-card">
        <div className="about-card__title">Indicator framework</div>
        <p className="about-card__body">
          Indicators are universally available on every feature chart and
          toggleable per-ticker. New indicators can be added by implementing a
          small Rust trait — the chart code is indicator-agnostic.
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
          <span className="about-tips__key">⚙ Manage Groups</span> in the
          sidebar reorganizes sectors and adds custom groups.
        </li>
        <li>
          <span className="about-tips__key">EDIT</span> inside a ticker
          dashboard adds, renames, deletes, and moves tickers. Renames change
          only the display name — the symbol stays fixed so cached bars keep
          working.
        </li>
      </ul>
    </div>
  );
}
