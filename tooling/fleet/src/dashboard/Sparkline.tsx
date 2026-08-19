/**
 * Inline SVG sparkline — no chart libraries (M3 rule). Null points render as
 * gaps; a lone point renders as a dot. Stroke/fill ride on currentColor so
 * the surrounding CSS (all var(--ds-*)) owns every color.
 */
export interface SparklineProps {
  values: (number | null)[];
  /** Fixed scale bounds; default min/max of the data. */
  min?: number;
  max?: number;
  width?: number;
  height?: number;
  label: string;
}

const W = 96;
const H = 24;
const PAD = 3;

export function Sparkline({ values, min, max, width = W, height = H, label }: SparklineProps) {
  const nums = values.filter((v): v is number => v !== null);
  if (nums.length === 0) {
    return <span className="fleet-spark fleet-spark--empty">—</span>;
  }
  const lo = min ?? Math.min(...nums);
  const hi = max ?? Math.max(...nums);
  const span = hi - lo || 1;
  const n = values.length;
  const x = (i: number) => (n === 1 ? width / 2 : PAD + (i * (width - 2 * PAD)) / (n - 1));
  const y = (v: number) => height - PAD - ((v - lo) / span) * (height - 2 * PAD);

  // Split into contiguous runs so nulls become visible gaps.
  const runs: { i: number; v: number }[][] = [];
  let current: { i: number; v: number }[] = [];
  values.forEach((v, i) => {
    if (v === null) {
      if (current.length > 0) runs.push(current);
      current = [];
    } else {
      current.push({ i, v });
    }
  });
  if (current.length > 0) runs.push(current);

  const lastIdx = values.reduce<number>((acc, v, i) => (v !== null ? i : acc), -1);
  const lastVal = lastIdx >= 0 ? (values[lastIdx] as number) : null;

  return (
    <svg
      className="fleet-spark"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
    >
      {runs.map((run, k) =>
        run.length === 1 ? (
          <circle key={k} cx={x((run[0] as { i: number }).i)} cy={y((run[0] as { v: number }).v)} r={2} fill="currentColor" />
        ) : (
          <polyline
            key={k}
            points={run.map((p) => `${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ),
      )}
      {lastVal !== null ? <circle cx={x(lastIdx)} cy={y(lastVal)} r={2.2} fill="currentColor" /> : null}
    </svg>
  );
}
