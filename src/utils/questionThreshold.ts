/**
 * The slider behind « Dépenses à vérifier à partir de… »: its steps, and what
 * a threshold would ask among the expenses nothing explains.
 */

// Uneven on purpose: the useful choices crowd the low end.
export const THRESHOLD_STEPS = [50, 100, 150, 200, 250, 300, 400, 500, 750, 1000, 1500, 2000, 3000, 5000, 10000]

/** The step closest to a stored threshold, which may sit between two. */
export function nearestStep(value: number): number {
  return THRESHOLD_STEPS.reduce(
    (best, step, index) => (Math.abs(step - value) < Math.abs(THRESHOLD_STEPS[best]! - value) ? index : best),
    0,
  )
}

/** The expenses a threshold asks about: those at or above it. */
export function askedAt(amounts: number[], threshold: number): { count: number; total: number } {
  const kept = amounts.filter((amount) => amount >= threshold)
  return { count: kept.length, total: kept.reduce((sum, amount) => sum + amount, 0) }
}
