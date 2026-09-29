/**
 * What the dashboard's net worth is made of. How it moved comes measured from
 * the API, which the MCP server quotes too.
 */
import type { DashboardStatisticsResponse } from '@/types'

export type CompositionKey = 'bank' | 'stock' | 'crypto' | 'placements' | 'brokerCash' | 'assets'

export interface CompositionSegment {
  key: CompositionKey
  /** The names the history chart's legend uses, so both read alike. */
  label: string
  value: number
  /** Share of the total, 0–100; negative for a pocket that owes (an overdrawn brokerage account). */
  share: number
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
