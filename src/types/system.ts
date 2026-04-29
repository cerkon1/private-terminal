export type DbInfo = {
  path: string;
  /** Total disk footprint = main file + WAL sidecar + SHM sidecar. */
  sizeBytes: number;
  mainBytes: number;
  walBytes: number;
  seriesCount: number;
  observationCount: number;
};

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatSignedBytes(bytes: number): string {
  const sign = bytes > 0 ? '+' : bytes < 0 ? '−' : '±';
  return `${sign}${formatBytes(Math.abs(bytes))}`;
}
