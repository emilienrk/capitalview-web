import { describe, expect, it } from 'vitest'
import { buildComposition } from '../netWorth'
import type { DashboardStatisticsResponse } from '@/types'

function statistics(overrides: Partial<{
  cash: number
  investments: number
  assets: number
  total: number
  stock: number
  crypto: number
  placements: number
}> = {}): DashboardStatisticsResponse {
  const o = { cash: 1000, investments: 5500, assets: 0, total: 6500, stock: 3000, crypto: 1500, placements: 800, ...overrides }
  return {
    distribution: {
      stock_invested: 0,
      stock_current_value: o.stock,
      stock_percentage: null,
      crypto_invested: 0,
      crypto_current_value: o.crypto,
      crypto_percentage: null,
      placements_invested: 0,
      placements_current_value: o.placements,
      placements_percentage: null,
      total_deposits: 0,
      total_withdrawals: 0,
    },
    wealth: {
      cash: o.cash,
      cash_percentage: null,
      investments: o.investments,
      investments_percentage: null,
      assets: o.assets,
      assets_percentage: null,
      total_deposits: 0,
      total_withdrawals: 0,
      total_wealth: o.total,
    },
    changes: [],
  }
}

describe('buildComposition', () => {
  it('names the idle brokerage cash the API folds into investments', () => {
    const segments = buildComposition(statistics(), { bankEnabled: true, wealthEnabled: true })

    expect(segments.map((s) => [s.key, s.value])).toEqual([
      ['bank', 1000],
      ['stock', 3000],
      ['crypto', 1500],
      ['placements', 800],
      ['brokerCash', 200],
    ])
    expect(segments.reduce((sum, s) => sum + s.share, 0)).toBeCloseTo(100)
  })

  it('keeps a negative pocket, so the lines still add up to the total', () => {
    const segments = buildComposition(statistics({ investments: 4800, total: 5800 }), { bankEnabled: true, wealthEnabled: true })

    expect(segments.find((s) => s.key === 'brokerCash')?.value).toBe(-500)
    expect(segments.reduce((sum, s) => sum + s.value, 0)).toBe(5800)
  })

  it('leaves out a disabled module and an empty pocket', () => {
    const segments = buildComposition(statistics({ cash: 400, assets: 900, investments: 5300, total: 6200 }), {
      bankEnabled: false,
      wealthEnabled: true,
    })

    expect(segments.map((s) => s.key)).toEqual(['stock', 'crypto', 'placements', 'assets'])
  })
})
