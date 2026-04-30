import type { ComponentType } from 'react';
import { CorrelationsTab } from './CorrelationsTab';
import { FinancialConditionsTab } from './FinancialConditionsTab';
import { PairsTab } from './PairsTab';
import { RecessionProbTab } from './RecessionProbTab';
import { RrgTab } from './RrgTab';
import { YieldCurveTab } from './YieldCurveTab';

/// Maps the analysis_tools.id from the registry to its tab component.
/// Adding a Phase 2+ tool: implement the Rust compute + the React tab,
/// then add the (id, Component) row here. Order is determined at runtime
/// by the AnalysisToolInfo.displayOrder field, not by this map.
export const ANALYSIS_TAB_REGISTRY: Record<string, ComponentType> = {
  correlation_matrix: CorrelationsTab,
  yield_curve: YieldCurveTab,
  pairs_ratio: PairsTab,
  rrg: RrgTab,
  recession_prob: RecessionProbTab,
  financial_conditions: FinancialConditionsTab,
};
