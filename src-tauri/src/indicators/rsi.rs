//! Wilder's RSI. Uses SMMA on gains and losses (Wilder smoothing == RMA == SMMA).
//! Output pane is a subpane below the price chart.

use serde::Deserialize;
use serde_json::Value;

use super::{
    close_series, smma::smma, Bar, Indicator, IndicatorOutput, IndicatorSeries, PaneKind,
    SeriesKind, SeriesPoint,
};

pub struct RsiIndicator;

#[derive(Debug, Deserialize)]
struct RsiParams {
    #[serde(default = "default_length")]
    length: usize,
}

fn default_length() -> usize {
    14
}

impl Default for RsiParams {
    fn default() -> Self {
        Self {
            length: default_length(),
        }
    }
}

const COLOR_RSI: &str = "#a855f7"; // violet

impl Indicator for RsiIndicator {
    fn id(&self) -> &'static str {
        "rsi_14"
    }
    fn display_name(&self) -> &'static str {
        "RSI (14)"
    }
    fn pane_hint(&self) -> PaneKind {
        PaneKind::Subpane
    }
    fn default_params(&self) -> Value {
        serde_json::json!({ "length": 14 })
    }

    fn compute(&self, bars: &[Bar], params: &Value) -> Result<IndicatorOutput, String> {
        let p: RsiParams = serde_json::from_value(params.clone()).unwrap_or_default();
        let close = close_series(bars);

        // delta_i = close_i - close_{i-1}. Bar 0 has no delta, so it is None
        // and the SMMA seed averages deltas 1..=length — first RSI lands at
        // index `length`, matching Wilder and TradingView `ta.rsi`. (The
        // trendscope port pushed a fake 0.0 here, which seeded one bar early
        // and biased the average low; corrected in v1.0.3.)
        let n = close.len();
        let mut gains: Vec<Option<f64>> = Vec::with_capacity(n);
        let mut losses: Vec<Option<f64>> = Vec::with_capacity(n);
        for i in 0..n {
            if i == 0 {
                gains.push(None);
                losses.push(None);
                continue;
            }
            match (close[i], close[i - 1]) {
                (Some(c), Some(prev)) => {
                    let d = c - prev;
                    gains.push(Some(if d > 0.0 { d } else { 0.0 }));
                    losses.push(Some(if d < 0.0 { -d } else { 0.0 }));
                }
                _ => {
                    gains.push(Some(0.0));
                    losses.push(Some(0.0));
                }
            }
        }

        let avg_gain = smma(&gains, p.length);
        let avg_loss = smma(&losses, p.length);

        let mut data = Vec::with_capacity(n);
        for i in 0..n {
            let rsi_val = match (avg_gain[i], avg_loss[i]) {
                (Some(g), Some(l)) if l != 0.0 => {
                    let rs = g / l;
                    Some(100.0 - (100.0 / (1.0 + rs)))
                }
                (Some(_), Some(l)) if l == 0.0 => Some(100.0),
                _ => None,
            };
            data.push(SeriesPoint {
                date: bars[i].date.clone(),
                value: rsi_val,
            });
        }

        Ok(IndicatorOutput {
            id: self.id().into(),
            display_name: self.display_name().into(),
            pane: self.pane_hint(),
            series: vec![IndicatorSeries {
                name: "RSI".into(),
                kind: SeriesKind::Line,
                color: COLOR_RSI.into(),
                data,
                stack_group: None,
                hidden: false,
            }],
            markers: vec![],
            regions: vec![],
        })
    }
}

#[cfg(test)]
mod tests {
    use super::RsiIndicator;
    use crate::indicators::{Bar, Indicator};

    fn bars(closes: &[f64]) -> Vec<Bar> {
        closes
            .iter()
            .enumerate()
            .map(|(i, &c)| Bar {
                date: format!("2026-01-{:02}", i + 1),
                open: Some(c),
                high: Some(c),
                low: Some(c),
                close: Some(c),
                volume: None,
            })
            .collect()
    }

    fn rsi(closes: &[f64], length: usize) -> Vec<Option<f64>> {
        let out = RsiIndicator
            .compute(&bars(closes), &serde_json::json!({ "length": length }))
            .unwrap();
        out.series[0].data.iter().map(|p| p.value).collect()
    }

    #[test]
    fn first_value_lands_at_index_length() {
        // Deltas: +1, -1 → avg gain 0.5, avg loss 0.5 → RSI 50.
        let out = rsi(&[10.0, 11.0, 10.0], 2);
        assert_eq!(out[0], None);
        assert_eq!(out[1], None);
        assert!((out[2].unwrap() - 50.0).abs() < 1e-9);
    }

    #[test]
    fn wilder_smoothing_after_seed() {
        // Seed (deltas +2, +1): g=1.5, l=0. Next delta -3: g=0.75, l=1.5.
        // RS = 0.5 → RSI = 100 - 100/1.5 = 33.333…
        let out = rsi(&[10.0, 12.0, 13.0, 10.0], 2);
        assert!((out[2].unwrap() - 100.0).abs() < 1e-9);
        assert!((out[3].unwrap() - 100.0 / 3.0).abs() < 1e-9);
    }

    #[test]
    fn monotonic_rise_is_100() {
        let closes: Vec<f64> = (1..=20).map(|v| v as f64).collect();
        let out = rsi(&closes, 14);
        assert_eq!(out[13], None);
        assert!((out[14].unwrap() - 100.0).abs() < 1e-9);
    }
}
