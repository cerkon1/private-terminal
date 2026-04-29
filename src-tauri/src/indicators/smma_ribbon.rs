//! SMMA Ribbon indicator.
//!
//! Four SMMAs on hl2 with lengths 15/19/25/29. State logic from the public
//! reverse-engineered gist (basnijholt,
//! https://gist.github.com/basnijholt/a78fe8deafe76bf3cc1f7e9817f9169e):
//!   p2 = mixed ordering                  -> NEUTRAL
//!   p3 = clean v1 < v2 (fast below slow) -> BEARISH
//!   p1 = clean v1 > v2 (fast above slow) -> BULLISH
//!
//! The confirm-N tweak is our own (per trendscope's "Tuning journey"): require
//! `confirm_bars` consecutive agreeing raw-state bars before committing.
//! Default confirm=3; don't re-tune without calibration data — trendscope
//! measured confirm=1/3/5 produce marginal shifts in state distribution.
//!
//! **Rendering shape.** The signal is a state-coloured filled polygon between
//! v1 and v2 — envelope width IS the signal (wide teal band = strong bullish
//! regime, wide fuchsia = strong bearish, narrow = weak/choppy). To reproduce
//! this in ECharts we emit six
//! series: a hidden stack-base (min of v1, v2) plus three state-coloured band
//! layers (|v1-v2| for bars in each state, 0 elsewhere), then two thin dark
//! outline lines for v1 and v2.

use serde::Deserialize;
use serde_json::Value;

use super::{
    high_low_mid, smma::smma, Bar, Indicator, IndicatorMarker, IndicatorOutput, IndicatorRegion,
    IndicatorSeries, PaneKind, SeriesKind, SeriesPoint,
};

pub struct SmmaRibbonIndicator;

#[derive(Debug, Deserialize)]
struct SmmaRibbonParams {
    #[serde(default = "default_lengths")]
    lengths: [usize; 4],
    #[serde(default = "default_confirm_bars")]
    confirm_bars: usize,
}

fn default_lengths() -> [usize; 4] {
    [15, 19, 25, 29]
}
fn default_confirm_bars() -> usize {
    3
}

impl Default for SmmaRibbonParams {
    fn default() -> Self {
        Self {
            lengths: default_lengths(),
            confirm_bars: default_confirm_bars(),
        }
    }
}

const STATE_BULLISH: &str = "bullish";
const STATE_BEARISH: &str = "bearish";
const STATE_NEUTRAL: &str = "neutral";

const LINE_COLOR: &str = "#9ca3af";
const BAND_STACK: &str = "smma_ribbon_band";
// ──────────── SMMA Ribbon state palette ────────────
// Palette deliberately diverges from the Larsson Line reference (gold/navy).
// Current: cyan-600 (deep teal-blue) + rose-400 (warm salmon-pink). Deep blue
// holds against bright green up-candles; rose stays warm without edging into
// red-candle territory.
//
// To swap the palette: edit the FILL_* / FLIP_* constants below AND the
// matching `--state-bull/bear/neutral` entries in `src/styles/tokens.css`.
// Rust can't read CSS vars, so these are the only two places to touch.
const FILL_BULL: &str = "rgba(8, 145, 178, 0.50)";    // cyan-600
const FILL_BEAR: &str = "rgba(251, 113, 133, 0.50)";  // rose-400
const FILL_NEUTRAL: &str = "rgba(156, 163, 175, 0.30)"; // gray-400
const FLIP_BULL: &str = "#0891B2";
const FLIP_BEAR: &str = "#FB7185";
const FLIP_GRAY: &str = "#9ca3af";

impl Indicator for SmmaRibbonIndicator {
    fn id(&self) -> &'static str {
        "smma_ribbon"
    }
    fn display_name(&self) -> &'static str {
        "SMMA Ribbon"
    }
    fn pane_hint(&self) -> PaneKind {
        PaneKind::Overlay
    }
    fn default_params(&self) -> Value {
        serde_json::json!({
            "lengths": [15, 19, 25, 29],
            "confirm_bars": 3,
        })
    }

    fn compute(&self, bars: &[Bar], params: &Value) -> Result<IndicatorOutput, String> {
        let p: SmmaRibbonParams =
            serde_json::from_value(params.clone()).unwrap_or_default();
        let [v1_len, m1_len, m2_len, v2_len] = p.lengths;

        let hl2 = high_low_mid(bars);
        let v1 = smma(&hl2, v1_len);
        let m1 = smma(&hl2, m1_len);
        let m2 = smma(&hl2, m2_len);
        let v2 = smma(&hl2, v2_len);

        let n = bars.len();
        let mut raw_state: Vec<&'static str> = Vec::with_capacity(n);
        for i in 0..n {
            match (v1[i], m1[i], m2[i], v2[i]) {
                (Some(a), Some(b), Some(c), Some(d)) => {
                    let p2 = ((a < b) != (a < d)) || ((c < d) != (a < d));
                    if p2 {
                        raw_state.push(STATE_NEUTRAL);
                    } else if a < d {
                        raw_state.push(STATE_BEARISH);
                    } else {
                        raw_state.push(STATE_BULLISH);
                    }
                }
                _ => raw_state.push(STATE_NEUTRAL), // warmup
            }
        }

        let state = confirm_state(&raw_state, p.confirm_bars);

        let mut v1_pts = Vec::with_capacity(n);
        let mut v2_pts = Vec::with_capacity(n);
        let mut base_pts = Vec::with_capacity(n);
        let mut bull_pts = Vec::with_capacity(n);
        let mut bear_pts = Vec::with_capacity(n);
        let mut neut_pts = Vec::with_capacity(n);

        for i in 0..n {
            let date = bars[i].date.clone();
            v1_pts.push(SeriesPoint {
                date: date.clone(),
                value: v1[i],
            });
            v2_pts.push(SeriesPoint {
                date: date.clone(),
                value: v2[i],
            });

            let (base, band) = match (v1[i], v2[i]) {
                (Some(a), Some(b)) => {
                    let base = a.min(b);
                    let band = (a - b).abs();
                    (Some(base), band)
                }
                _ => (None, 0.0),
            };
            base_pts.push(SeriesPoint {
                date: date.clone(),
                value: base,
            });
            let is_bull = state[i] == STATE_BULLISH;
            let is_bear = state[i] == STATE_BEARISH;
            let is_neut = state[i] == STATE_NEUTRAL;
            bull_pts.push(SeriesPoint {
                date: date.clone(),
                value: if is_bull { Some(band) } else { Some(0.0) },
            });
            bear_pts.push(SeriesPoint {
                date: date.clone(),
                value: if is_bear { Some(band) } else { Some(0.0) },
            });
            neut_pts.push(SeriesPoint {
                date,
                value: if is_neut { Some(band) } else { Some(0.0) },
            });
        }

        // Series names are human-readable labels — they appear verbatim in
        // the chart legend, so no snake_case / programmer shorthand here.
        // The `Base` series is transparent (stack baseline) and is filtered
        // out of the legend on the frontend by its `rgba(0,0,0,0)` color.
        let series = vec![
            IndicatorSeries {
                name: "Base".into(),
                kind: SeriesKind::Line,
                color: "rgba(0,0,0,0)".into(),
                data: base_pts,
                stack_group: Some(BAND_STACK.into()),
                hidden: true,
            },
            IndicatorSeries {
                name: "Bull Band".into(),
                kind: SeriesKind::Line,
                color: FILL_BULL.into(),
                data: bull_pts,
                stack_group: Some(BAND_STACK.into()),
                hidden: true,
            },
            IndicatorSeries {
                name: "Bear Band".into(),
                kind: SeriesKind::Line,
                color: FILL_BEAR.into(),
                data: bear_pts,
                stack_group: Some(BAND_STACK.into()),
                hidden: true,
            },
            IndicatorSeries {
                name: "Neutral Band".into(),
                kind: SeriesKind::Line,
                color: FILL_NEUTRAL.into(),
                data: neut_pts,
                stack_group: Some(BAND_STACK.into()),
                hidden: true,
            },
            IndicatorSeries {
                name: "SMMA Fast".into(),
                kind: SeriesKind::Line,
                color: LINE_COLOR.into(),
                data: v1_pts,
                stack_group: None,
                hidden: false,
            },
            IndicatorSeries {
                name: "SMMA Slow".into(),
                kind: SeriesKind::Line,
                color: LINE_COLOR.into(),
                data: v2_pts,
                stack_group: None,
                hidden: false,
            },
        ];

        let regions = state_regions(bars, &state);
        let markers = state_flip_markers(bars, &state);

        Ok(IndicatorOutput {
            id: self.id().into(),
            display_name: self.display_name().into(),
            pane: self.pane_hint(),
            series,
            markers,
            regions,
        })
    }
}

fn confirm_state(raw: &[&'static str], confirm_bars: usize) -> Vec<&'static str> {
    assert!(confirm_bars >= 1);
    if confirm_bars == 1 {
        return raw.to_vec();
    }
    let n = raw.len();
    let mut run_len: usize = 0;
    let mut committed: Vec<&'static str> = Vec::with_capacity(n);
    let mut last_committed: &'static str = STATE_NEUTRAL;

    for i in 0..n {
        if i > 0 && raw[i] == raw[i - 1] {
            run_len += 1;
        } else {
            run_len = 1;
        }
        if run_len >= confirm_bars {
            last_committed = raw[i];
        }
        committed.push(last_committed);
    }
    committed
}

fn state_regions(bars: &[Bar], state: &[&'static str]) -> Vec<IndicatorRegion> {
    let mut out = Vec::new();
    if bars.is_empty() {
        return out;
    }
    let mut run_start = 0usize;
    for i in 1..bars.len() {
        if state[i] != state[i - 1] {
            out.push(region(bars, state[i - 1], run_start, i - 1));
            run_start = i;
        }
    }
    out.push(region(bars, state[bars.len() - 1], run_start, bars.len() - 1));
    out
}

fn region(bars: &[Bar], state: &'static str, start: usize, end: usize) -> IndicatorRegion {
    IndicatorRegion {
        start_date: bars[start].date.clone(),
        end_date: bars[end].date.clone(),
        color: "rgba(0,0,0,0)".into(),
        label: state.into(),
    }
}

fn state_flip_markers(bars: &[Bar], state: &[&'static str]) -> Vec<IndicatorMarker> {
    let mut out = Vec::new();
    for i in 1..bars.len() {
        if state[i] == state[i - 1] {
            continue;
        }
        let anchor = bars[i].low.unwrap_or_else(|| bars[i].close.unwrap_or(0.0));
        let (label, color, symbol) = match state[i] {
            STATE_BULLISH => ("Bull Flip", FLIP_BULL, "triangle-up"),
            STATE_BEARISH => ("Bear Flip", FLIP_BEAR, "triangle-down"),
            _ => ("Neutral Flip", FLIP_GRAY, "circle"),
        };
        out.push(IndicatorMarker {
            date: bars[i].date.clone(),
            value: anchor,
            label: label.into(),
            color: color.into(),
            symbol: symbol.into(),
        });
    }
    out
}
