import type { ComponentType } from 'react';
import { CorrelationsTab } from './CorrelationsTab';
import { YieldCurveTab } from './YieldCurveTab';

/// Maps the analysis_tools.id from the registry to its tab component.
/// Adding a Phase 2+ tool: implement the Rust compute + the React tab,
/// then add the (id, Component) row here. Order is determined at runtime
/// by the AnalysisToolInfo.displayOrder field, not by this map.
export const ANALYSIS_TAB_REGISTRY: Record<string, ComponentType> = {
  correlation_matrix: CorrelationsTab,
  yield_curve: YieldCurveTab,
};
