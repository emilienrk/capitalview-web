import { describe, expect, it } from 'vitest'
import { changeSince, previousSnapshotPrices } from '../cryptoPositions'
import type { AccountHistorySnapshotResponse } from '@/types'

function snapshot(date: string, prices: Record<string, number | null>): AccountHistorySnapshotResponse {
  return {
    snapshot_date: date, total_value: 0, total_invested: 0, total_deposits: 0, total_withdrawals: 0,
    daily_pnl: null, cumulative_pnl: null, total_fees: null, total_dividends: null,
    positions: Object.entries(prices).map(([asset_key, price]) => ({ asset_key, quantity: 1, value: 0, price, invested: 0, percentage: 0 })),
  }
}

describe('previousSnapshotPrices', () => {
  it('prend le dernier relevé avant aujourd’hui, pas le point du jour', () => {
    const ref = previousSnapshotPrices([
      snapshot('2026-09-27', { BTC: 57000 }),
      snapshot('2026-09-28', { BTC: 57900, ETH: 2320 }),
      snapshot('2026-09-29', { BTC: 58900 }),
    ], '2026-09-29')
    expect(ref).toEqual({ date: '2026-09-28', prices: { BTC: 57900, ETH: 2320 } })
  })

  it('ignore les cours absents', () => {
    expect(previousSnapshotPrices([snapshot('2026-09-28', { BTC: null })], '2026-09-29')).toBeNull()
  })
})

describe('changeSince', () => {
  it('mesure la variation en pourcentage', () => {
    expect(changeSince(58900, 57900)).toBeCloseTo(1.727, 3)
  })

  it('ne lit rien sur un cours arrondi au centime sous 10 €', () => {
    expect(changeSince(0.8612, 0.86)).toBeNull()
    expect(changeSince(0.8612, 0.8605)).toBeCloseTo(0.0813, 3)
  })

  it('ne lit rien sans référence', () => {
    expect(changeSince(100, undefined)).toBeNull()
    expect(changeSince(null, 100)).toBeNull()
  })
})
