/**
 * Shaping helpers for the per-asset price chart: turning the API's sparse
 * timeline into the arrays ECharts wants. Kept out of the component so the
 * arithmetic can be tested without mounting a canvas.
 */

import type { AssetPricePoint, AssetTimelineEvent } from '@/types'

/**
 * Floor for a trade far below the largest one: under it a disc and its ring
 * read as noise. Only dust hits it — a trade a tenth of the largest is 8 px.
 */
export const MIN_MARKER_SIZE = 6
/** Diameter of the largest trade shown; every other marker is sized against it. */
export const MAX_MARKER_SIZE = 26
/**
 * The same on a phone. A 26 px disc is 7 % of a 390 px-wide plot, so a run of
 * large buys a few days apart fuses into one blob; capping lower keeps them
 * apart. The tap target does not shrink with it — see nearestMarker.
 */
export const SMALL_SCREEN_MAX_MARKER_SIZE = 20

/**
 * How far an executed price may sit from the day's close before it is treated
 * as a data problem rather than a trade: a factor of two either way. No liquid
 * market moves that far inside one day, so a sale booked at 3 € on a day ETH
 * closed at 2 300 € says the row is mis-entered, not that the trade was bad.
 */
export const OFF_MARKET_FACTOR = 2

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
 *
 * Scaled from the largest trade down rather than from a fixed minimum up: an
 * offset added to every marker made a 0,11 € buy a third the width of a 22 €
 * one, where its area says it is two hundred times smaller.
 */
export function markerSize(
  total: number,
  largest: number,
  max: number = MAX_MARKER_SIZE,
): number {
  if (!Number.isFinite(total) || !Number.isFinite(largest) || largest <= 0) {
    return max / 2
  }
  const share = Math.min(Math.abs(total) / largest, 1)
  return Math.max(MIN_MARKER_SIZE, max * Math.sqrt(share))
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

/**
 * A date → close reader that falls back to the last close before it.
 *
 * Mirrors the API's own lookup: a trade on a day the market never quoted (a
 * weekend for a stock, a gap left by a failed backfill) is compared with the
 * price that stood then, not with nothing.
 */
export function closeLookup(points: AssetPricePoint[]): (date: string) => number | null {
  const sorted = [...points]
    .map((point) => ({ date: point.date, price: Number(point.price) }))
    .filter((point) => Number.isFinite(point.price))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

  return (date: string) => {
    if (sorted.length === 0) return null
    // Last index whose date is <= the one asked for; ISO dates sort as strings.
    let low = 0
    let high = sorted.length - 1
    let found = -1
    while (low <= high) {
      const middle = (low + high) >> 1
      if (sorted[middle]!.date <= date) {
        found = middle
        low = middle + 1
      } else {
        high = middle - 1
      }
    }
    return sorted[found === -1 ? 0 : found]!.price
  }
}

/** One trade as drawn: where it sits, and how it compares with its day. */
export interface PlottedMarker {
  event: AssetTimelineEvent
  /**
   * The height the marker is drawn at: the executed price, except when that
   * price is off-market, where it rides the day's close instead — one mis-entered
   * row must not drag the whole axis down to zero and flatten the curve.
   */
  y: number
  /** Close of the trade's day (or the last one before it), when any is known. */
  close: number | null
  /** The executed price is more than OFF_MARKET_FACTOR away from that close. */
  offMarket: boolean
}

/**
 * The trades that can be drawn, oldest first, each placed against its day.
 *
 * Income already rides the curve (the API places it at the day's close), so it
 * is never off-market; only a buy or a sale carries a price of its own that can
 * disagree with the market.
 */
export function buildMarkers(
  events: AssetTimelineEvent[],
  closeOn: (date: string) => number | null,
): PlottedMarker[] {
  return events
    .map((event, index) => ({ event, index }))
    .filter(({ event }) => event.price != null && Number.isFinite(Number(event.price)))
    // Stable on equal dates, so same-day trades keep the order the API gave.
    .sort((a, b) =>
      a.event.date < b.event.date ? -1 : a.event.date > b.event.date ? 1 : a.index - b.index,
    )
    .map(({ event }) => {
      const price = Number(event.price)
      const close = closeOn(event.date)
      const ratio = close != null && close > 0 ? price / close : null
      const offMarket =
        event.type !== 'INCOME'
        && ratio != null
        && (ratio < 1 / OFF_MARKET_FACTOR || ratio > OFF_MARKET_FACTOR)
      return { event, y: offMarket && close != null ? close : price, close, offMarket }
    })
}

/**
 * Index of the marker closest to a tap, or -1 when none is within reach.
 *
 * Selecting by distance rather than by hit-testing the drawn disc is what makes
 * small markers tappable: an 8 px point is far below a fingertip, and in a
 * cluster the disc on top is not necessarily the one the finger meant.
 * Positions that are off the plot (null) are skipped.
 */
export function nearestMarker(
  positions: Array<{ x: number; y: number } | null>,
  target: { x: number; y: number },
  radius: number,
): number {
  let best = -1
  let bestDistance = radius * radius
  positions.forEach((position, index) => {
    if (!position) return
    const dx = position.x - target.x
    const dy = position.y - target.y
    const distance = dx * dx + dy * dy
    if (distance <= bestDistance) {
      best = index
      bestDistance = distance
    }
  })
  return best
}
