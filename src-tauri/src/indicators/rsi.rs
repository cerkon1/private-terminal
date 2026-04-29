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

        // delta_i = close_i - close_{i-1}, first bar is None (treated as zero).
        let n = close.len();
        let mut gains: Vec<Option<f64>> = Vec::with_capacity(n);
        let mut losses: Vec<Option<f64>> = Vec::with_capacity(n);
        for i in 0..n {
            if i == 0 {
                gains.push(Some(0.0));
                losses.push(Some(0.0));
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
