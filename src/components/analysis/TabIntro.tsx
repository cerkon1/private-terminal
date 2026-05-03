import type { ReactNode } from 'react';

type Props = {
  /** Always-visible one-sentence description of what this chart shows.
   *  Optional — Analysis tabs ship with a subtitle per the S17 pattern;
   *  Pulse and other surfaces with their own banner can omit it. */
  subtitle?: string;
  /** Body of the "How to read this" disclosure — interpretation guide.
   *  Use a fragment with <ul>/<p> for structure. */
  howToRead: ReactNode;
  /** Optional "The math" disclosure body. Only rendered when provided. */
  math?: ReactNode;
  /** Override the default liability framing. */
  liabilityNote?: string;
};

const DEFAULT_LIABILITY =
  'Decision support, not investment advice. Patterns are descriptive, not predictive.';

/// Standard intro block rendered at the top of every Analysis tab. Three
/// progressively-disclosed layers: a one-sentence subtitle (always on), a
/// "How to read this" interpretation guide (collapsed), and an optional
/// "The math" formula reference (collapsed). Established S17 — every
/// Phase 2+ analysis tab must render this so users have a way in. See
/// `.projects/02_v1_1_analysis/v11_analysis_design.md` "Tab presentation
/// pattern" section for the rule.
export function TabIntro({ subtitle, howToRead, math, liabilityNote }: Props) {
  return (
    <div className="tab-intro">
      {subtitle && <p className="tab-intro__subtitle">{subtitle}</p>}
      <div className="tab-intro__disclosures">
        <details className="tab-intro__disclosure">
          <summary className="tab-intro__summary">How to read this</summary>
          <div className="tab-intro__body">
            {howToRead}
            <p className="tab-intro__liability">
              {liabilityNote ?? DEFAULT_LIABILITY}
            </p>
          </div>
        </details>
        {math !== undefined && (
          <details className="tab-intro__disclosure">
            <summary className="tab-intro__summary">The math</summary>
            <div className="tab-intro__body tab-intro__body--math">{math}</div>
          </details>
        )}
      </div>
    </div>
  );
}
