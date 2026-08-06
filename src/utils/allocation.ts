/**
 * Whole-point allocations that actually add up.
 *
 * Rounding four portfolio weights to whole percentages lands on 99 or 101 far
 * more often than on 100, and both the form and the API reject anything more
 * than a point off. Pre-filling a period from the real portfolio and having the
 * first save fail reads as the form being broken, so the remainder is placed
 * rather than left for the user to hunt down: it goes to the largest line, where
 * one point is noise.
 */

export interface SharedLine {
  key: string
  weight: number
}

/**
 * Weights (in any scale) as whole percentages summing to exactly 100.
 * Lines rounding to zero are dropped: a 0 % target is not a target.
 */
export function normalisedShares(lines: SharedLine[]): { key: string; share: number }[] {
  const positive = lines.filter((line) => Number.isFinite(line.weight) && line.weight > 0)
  const total = positive.reduce((sum, line) => sum + line.weight, 0)
  if (!positive.length || total <= 0) return []

  const shares = positive.map((line) => ({
    key: line.key,
    share: Math.round((line.weight / total) * 100),
  }))

  const kept = shares.filter((line) => line.share > 0)
  if (!kept.length) return []

  // The drift after rounding is at most half a point per line; giving it all to
  // the largest keeps every other figure exactly as the user would have written.
  const drift = 100 - kept.reduce((sum, line) => sum + line.share, 0)
  const largest = kept.reduce((best, line) => (line.share > best.share ? line : best))
  largest.share += drift
  return kept
}

/**
 * Move the remainder onto the largest line so a hand-edited allocation reaches
 * 100 without the user having to work out which figure to change.
 */
export function balancedShares(lines: SharedLine[]): { key: string; share: number }[] {
  const shares = lines.map((line) => ({
    key: line.key,
    share: Number.isFinite(line.weight) ? line.weight : 0,
  }))
  if (!shares.length) return shares

  const drift = 100 - shares.reduce((sum, line) => sum + line.share, 0)
  const largest = shares.reduce((best, line) => (line.share > best.share ? line : best))
  largest.share = Math.max(0, largest.share + drift)
  return shares
}
