//! Wilder's ATR.
//! TR_i = max(high-low, |high - prev_close|, |low - prev_close|).
//! First bar falls back to `high - low` since there is no prev_close.
//! ATR is the SMMA of TR.

use serde::Deserialize;
use serde_json::Value;

use super::{
    smma::smma, Bar, Indicator, IndicatorOutput, IndicatorSeries, PaneKind, SeriesKind,
    SeriesPoint,
};

pub struct AtrIndicator;

#[derive(Debug, Deserialize)]
struct AtrParams {
    #[serde(default = "default_length")]
    length: usize,
}

fn default_length() -> usize {
    14
}

impl Default for AtrParams {
    fn default() -> Self {
        Self {
            length: default_length(),
        }
    }
}

const COLOR_ATR: &str = "#10b981"; // emerald

impl Indicator for AtrIndicator {
    fn id(&self) -> &'static str {
        "atr_14"
    }
    fn display_name(&self) -> &'static str {
        "ATR (14)"
    }
    fn pane_hint(&self) -> PaneKind {
        PaneKind::Subpane
    }
    fn default_params(&self) -> Value {
        serde_json::json!({ "length": 14 })
    }

    fn compute(&self, bars: &[Bar], params: &Value) -> Result<IndicatorOutput, String> {
        let p: AtrParams = serde_json::from_value(params.clone()).unwrap_or_default();
        let n = bars.len();
        let mut tr: Vec<Option<f64>> = Vec::with_capacity(n);

        for i in 0..n {
            match (bars[i].high, bars[i].low) {
                (Some(h), Some(l)) => {
                    let mut v = (h - l).abs();
                    if i > 0 {
                        if let Some(pc) = bars[i - 1].close {
                            v = v.max((h - pc).abs()).max((l - pc).abs());
                        }
                    }
                    tr.push(Some(v));
                }
                _ => tr.push(None),
            }
        }

        let atr = smma(&tr, p.length);
        let mut data = Vec::with_capacity(n);
        for i in 0..n {
            data.push(SeriesPoint {
                date: bars[i].date.clone(),
                value: atr[i],
            });
        }

        Ok(IndicatorOutput {
            id: self.id().into(),
            display_name: self.display_name().into(),
            pane: self.pane_hint(),
            series: vec![IndicatorSeries {
                name: "ATR".into(),
                kind: SeriesKind::Line,
                color: COLOR_ATR.into(),
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
    use super::AtrIndicator;
    use crate::indicators::{Bar, Indicator};

    fn bar(h: f64, l: f64, c: f64) -> Bar {
        Bar { date: String::new(), open: Some(c), high: Some(h), low: Some(l), close: Some(c), volume: None }
    }

    fn atr(bars: &[Bar], length: usize) -> Vec<Option<f64>> {
        AtrIndicator
            .compute(bars, &serde_json::json!({ "length": length }))
            .unwrap()
            .series[0]
            .data
            .iter()
            .map(|p| p.value)
            .collect()
    }

    #[test]
    fn true_range_and_wilder_smoothing_known_answer() {
        // TR: bar0 = 10-8 = 2 (no prev close); bar1 = max(3, |12-9|, |9-9|) = 3;
        // bar2 = max(1, |11-11|, |10-11|) = 1. ATR(2): seed (2+3)/2 = 2.5,
        // then (2.5*1 + 1)/2 = 1.75.
        let bars = [bar(10.0, 8.0, 9.0), bar(12.0, 9.0, 11.0), bar(11.0, 10.0, 10.5)];
        let out = atr(&bars, 2);
        assert_eq!(out[0], None);
        assert!((out[1].unwrap() - 2.5).abs() < 1e-12);
        assert!((out[2].unwrap() - 1.75).abs() < 1e-12);
    }

    #[test]
    fn gap_up_uses_previous_close() {
        // Gap: prev close 10, bar trades 14-13 → TR = |14-10| = 4, not 1.
        let bars = [bar(10.0, 10.0, 10.0), bar(14.0, 13.0, 13.5)];
        let out = atr(&bars, 1);
        assert!((out[1].unwrap() - 4.0).abs() < 1e-12);
    }

    #[test]
    fn missing_high_low_does_not_end_the_series() {
        let mut bars = vec![bar(10.0, 8.0, 9.0), bar(12.0, 9.0, 11.0), bar(11.0, 10.0, 10.5)];
        bars.push(Bar { high: None, low: None, ..bar(0.0, 0.0, 10.5) });
        bars.push(bar(11.0, 10.0, 10.5));
        let out = atr(&bars, 2);
        assert_eq!(out[3], None);
        assert!(out[4].is_some(), "ATR must resume after a partial bar");
    }
}
