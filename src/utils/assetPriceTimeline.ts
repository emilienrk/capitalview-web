/**
 * Shaping helpers for the per-asset price chart: turning the API's sparse
 * timeline into the arrays ECharts wants. Kept out of the component so the
 * arithmetic can be tested without mounting a canvas.
 */

import type { AssetPricePoint, AssetTimelineEvent } from '@/types'

/** Smallest marker that still reads as a deliberate point rather than noise. */
export const MIN_MARKER_SIZE = 8
/** How much a marker may grow above the minimum, for the largest trade shown. */
export const MARKER_SIZE_RANGE = 18

/**
 * The category axis is the union of quoted days and trade days: a trade can land
 * on a day the market never quoted (a holiday, or a gap the backfill could not
 * fill), and dropping it would silently lose the marker.
 */
export function buildTimelineDates(
  points: AssetPricePoint[],
  events: AssetTimelineEvent[],
): string[] {
  const all = new Set<string>()
  for (const point of points) all.add(point.date)
  for (const event of events) all.add(event.date)
  return Array.from(all).sort()
}

/**
 * Bubble area, not radius, carries the amount: the eye reads a disc by its area,
 * so a trade ten times larger must come out about three times wider, not ten.
 */
export function markerSize(total: number, largest: number): number {
  if (!Number.isFinite(total) || !Number.isFinite(largest) || largest <= 0) {
    return MIN_MARKER_SIZE + MARKER_SIZE_RANGE / 2
  }
  const share = Math.min(Math.abs(total) / largest, 1)
  return MIN_MARKER_SIZE + MARKER_SIZE_RANGE * Math.sqrt(share)
}

/** The largest trade on the chart, which every other marker is sized against. */
export function largestTradeTotal(events: AssetTimelineEvent[]): number {
  return events.reduce((max, event) => Math.max(max, Math.abs(Number(event.total ?? 0))), 0)
}

/**
 * The unit cost basis carried by every day rather than only by trade days: the
 * value is piecewise constant, so materialising it draws the steps on its own,
 * and a position sold down to nothing leaves a real gap in the line instead of
 * a segment running through a cost that no longer exists.
 */
export function buildCostBasisSeries(
  dates: string[],
  events: AssetTimelineEvent[],
): Array<number | null> {
  const byDate = new Map<string, number | null>()
  for (const event of events) {
    byDate.set(event.date, event.cost_basis_after == null ? null : Number(event.cost_basis_after))
  }

  let carried: number | null = null
  let started = false

  return dates.map((date) => {
    if (byDate.has(date)) {
      carried = byDate.get(date) ?? null
      started = true
    }
    return started ? carried : null
  })
}
