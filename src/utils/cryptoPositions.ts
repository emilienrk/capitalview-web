import type { AccountHistorySnapshotResponse } from '@/types'

export interface PriceReference {
  /** 'YYYY-MM-DD' of the snapshot the prices come from. */
  date: string
  prices: Record<string, number>
}

/** Each asset's price in the last snapshot before `today`: what a change "since" reads against. */
export function previousSnapshotPrices(history: AccountHistorySnapshotResponse[], today: string): PriceReference | null {
  for (let idx = history.length - 1; idx >= 0; idx -= 1) {
    const snapshot = history[idx]
    if (!snapshot) continue
    const day = snapshot.snapshot_date.slice(0, 10)
    if (day >= today) continue
    const prices: Record<string, number> = {}
    for (const position of snapshot.positions ?? []) {
      const price = Number(position.price)
      if (position.price != null && Number.isFinite(price) && price > 0) prices[position.asset_key] = price
    }
    return Object.keys(prices).length ? { date: day, prices } : null
  }
  return null
}

/** Percent change from `reference` to `current`, or null when it can't be told. */
export function changeSince(current: number | null | undefined, reference: number | undefined): number | null {
  if (current == null || reference == null || !(reference > 0)) return null
  // Snapshots stored before the API kept more decimals were rounded to the
  // cent, too coarse under 10 € to read a day's move from.
  if (reference < 10 && Math.abs(reference * 100 - Math.round(reference * 100)) < 1e-9) return null
  return (Number(current) / reference - 1) * 100
}
