/**
 * Nearest-name suggestion for closed-world errors, matching the house style
 * of @ds/mcp's `validate_usage` ("Did you mean: …"). Pure Levenshtein —
 * deterministic, no LLM anywhere in this path.
 */

function editDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dist: number[] = new Array<number>(rows * cols).fill(0);
  for (let i = 0; i < rows; i++) dist[i * cols] = i;
  for (let j = 0; j < cols; j++) dist[j] = j;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dist[i * cols + j] = Math.min(
        (dist[(i - 1) * cols + j] as number) + 1,
        (dist[i * cols + (j - 1)] as number) + 1,
        (dist[(i - 1) * cols + (j - 1)] as number) + cost,
      );
    }
  }
  return dist[rows * cols - 1] as number;
}

export function nearestNames(target: string, candidates: string[], max = 3): string[] {
  return candidates
    .map((c) => ({ c, d: editDistance(target.toLowerCase(), c.toLowerCase()) }))
    .sort((x, y) => x.d - y.d || x.c.localeCompare(y.c))
    .slice(0, max)
    .map((x) => x.c);
}
