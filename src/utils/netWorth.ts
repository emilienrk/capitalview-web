/**
 * The dashboard's headline: what the whole net worth is worth now, how it moved,
 * and what it is made of.
 */
import type { DashboardStatisticsResponse, GlobalHistorySnapshotResponse } from '@/types'

export type CompositionKey = 'bank' | 'stock' | 'crypto' | 'placements' | 'brokerCash' | 'assets'

export interface CompositionSegment {
  key: CompositionKey
  /** The names the history chart's legend uses, so both read alike. */
  label: string
  value: number
  /** Share of the total, 0–100; negative for a pocket that owes (an overdrawn brokerage account). */
  share: number
}

export interface NetWorthChange {
  key: 'lastSnapshot' | 'month' | 'year'
  /** The snapshot compared against: the change is measured from its date. */
  since: string
  diff: number
  /** null when the reference was zero: a percentage of nothing means nothing. */
  percent: number | null
}

const LABELS: Record<CompositionKey, string> = {
  bank: 'Cash',
  stock: 'Bourse',
  crypto: 'Crypto',
  placements: 'Placements',
  brokerCash: 'Espèces courtiers',
  assets: 'Patrimoine matériel',
}

/** Within a cent of zero a segment is rounding noise, not a pocket of money. */
const EPSILON = 0.005

export function buildComposition(
  statistics: DashboardStatisticsResponse,
  options: { bankEnabled: boolean; wealthEnabled: boolean },
): CompositionSegment[] {
  const { distribution, wealth } = statistics
  const stock = Number(distribution.stock_current_value ?? 0)
  const crypto = Number(distribution.crypto_current_value ?? 0)
  const placements = Number(distribution.placements_current_value ?? 0)
  // The API folds the cash idle on brokerage and exchange accounts into
  // `investments` without a line of its own: it is what is left over.
  const brokerCash = Number(wealth.investments ?? 0) - stock - crypto - placements

  const values: Array<[CompositionKey, number]> = [
    ['bank', options.bankEnabled ? Number(wealth.cash ?? 0) : 0],
    ['stock', stock],
    ['crypto', crypto],
    ['placements', placements],
    ['brokerCash', brokerCash],
    ['assets', options.wealthEnabled ? Number(wealth.assets ?? 0) : 0],
  ]

  const total = Number(wealth.total_wealth ?? 0)
  return values
    // A negative pocket stays: leaving it out would make the lines add up to
    // more than the total they explain.
    .filter(([, value]) => Math.abs(value) > EPSILON)
    .map(([key, value]) => ({
      key,
      label: LABELS[key],
      value,
      share: total > 0 ? (value / total) * 100 : 0,
    }))
}

/** Local calendar date as YYYY-MM-DD: snapshots are civil days, not instants. */
export function isoDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

type Pocket = 'bank_value' | 'stock_value' | 'crypto_value' | 'placements_value' | 'assets_value'

/**
 * A day's snapshot is a union of every category's own snapshots, and a category
 * with none that day counts zero. Measuring from such a day would report the
 * missing pocket as a gain, so a reference must carry every pocket held today.
 */
function carriesEveryPocket(snapshot: GlobalHistorySnapshotResponse, held: Pocket[]): boolean {
  return held.every((pocket) => Number(snapshot[pocket] ?? 0) > 0)
}

/** The latest complete snapshot strictly before `before` (YYYY-MM-DD). */
export function referenceSnapshot(
  history: GlobalHistorySnapshotResponse[],
  before: string,
  held: Pocket[],
): GlobalHistorySnapshotResponse | null {
  let found: GlobalHistorySnapshotResponse | null = null
  for (const snapshot of history) {
    const day = snapshot.snapshot_date.slice(0, 10)
    if (day >= before) continue
    if (!carriesEveryPocket(snapshot, held)) continue
    if (!found || day > found.snapshot_date.slice(0, 10)) found = snapshot
  }
  return found
}

/** Which history pockets the live total holds, so a reference can be checked against them. */
export function heldPockets(composition: CompositionSegment[]): Pocket[] {
  const pockets = new Set<Pocket>()
  for (const segment of composition) {
    if (segment.key === 'bank') pockets.add('bank_value')
    // The history counts idle brokerage cash inside the stock and crypto
    // accounts it sits on, so it asks for no pocket of its own.
    if (segment.key === 'stock') pockets.add('stock_value')
    if (segment.key === 'crypto') pockets.add('crypto_value')
    if (segment.key === 'placements') pockets.add('placements_value')
    if (segment.key === 'assets') pockets.add('assets_value')
  }
  return [...pockets]
}

/**
 * The live total against the last snapshot, the end of last month and the end
 * of last year. Two references on the same snapshot say the same thing twice,
 * so the wider period is dropped.
 */
export function netWorthChanges(
  total: number,
  history: GlobalHistorySnapshotResponse[],
  held: Pocket[],
  today: Date = new Date(),
): NetWorthChange[] {
  const todayIso = isoDay(today)
  const monthStart = `${todayIso.slice(0, 7)}-01`
  const yearStart = `${todayIso.slice(0, 4)}-01-01`

  const candidates: Array<[NetWorthChange['key'], string]> = [
    ['lastSnapshot', todayIso],
    ['month', monthStart],
    ['year', yearStart],
  ]

  const changes: NetWorthChange[] = []
  const seen = new Set<string>()
  for (const [key, before] of candidates) {
    const reference = referenceSnapshot(history, before, held)
    if (!reference) continue
    const since = reference.snapshot_date.slice(0, 10)
    if (seen.has(since)) continue
    seen.add(since)
    const base = Number(reference.total_wealth)
    const diff = total - base
    changes.push({ key, since, diff, percent: base > 0 ? (diff / base) * 100 : null })
  }
  return changes
}
