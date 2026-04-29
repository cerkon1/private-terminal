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
