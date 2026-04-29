import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { RecessionSegment } from '../types/analysis';

/// Module-level cache so `list_recession_segments` fires once per session
/// rather than once per chart. NBER dates change rarely; pre-S15 design
/// agreed not to invalidate within a session — restart picks up new data
/// when USREC observations refresh.
let cachedSegments: RecessionSegment[] | null = null;
let inflight: Promise<RecessionSegment[]> | null = null;

/// ECharts `markArea.data` row: a pair of `{ xAxis }` points marking start
/// and end of the highlighted interval.
export type MarkAreaPair = [{ xAxis: string }, { xAxis: string }];

export type UseRecessionBars = {
  segments: RecessionSegment[];
  /** Drop into `series[].markArea.data` (or top-level `graphic.markArea`). */
  markAreaData: MarkAreaPair[];
  loaded: boolean;
  error: string | null;
};

async function fetchOnce(): Promise<RecessionSegment[]> {
  if (cachedSegments) return cachedSegments;
  if (inflight) return inflight;
  inflight = invoke<RecessionSegment[]>('list_recession_segments').then((r) => {
    cachedSegments = r;
    inflight = null;
    return r;
  });
  return inflight;
}

/// Returns NBER recession segments + a pre-shaped ECharts markArea data array.
/// Multiple chart components calling this hook share a single fetch.
export function useRecessionBars(): UseRecessionBars {
  const [segments, setSegments] = useState<RecessionSegment[]>(cachedSegments ?? []);
  const [loaded, setLoaded] = useState<boolean>(cachedSegments !== null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cachedSegments !== null) return;
    let active = true;
    fetchOnce()
      .then((r) => {
        if (!active) return;
        setSegments(r);
        setLoaded(true);
      })
      .catch((e) => {
        if (!active) return;
        setError(typeof e === 'string' ? e : String(e));
        setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const markAreaData: MarkAreaPair[] = segments.map((s) => [
    { xAxis: s.start },
    { xAxis: s.end },
  ]);

  return { segments, markAreaData, loaded, error };
}
