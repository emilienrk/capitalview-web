import { describe, expect, it } from 'vitest'
import { buildComposition, heldPockets, netWorthChanges, referenceSnapshot } from '../netWorth'
import type { DashboardStatisticsResponse, GlobalHistorySnapshotResponse } from '@/types'

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
  }
}

function snapshot(date: string, total: number, pockets: Partial<GlobalHistorySnapshotResponse> = {}): GlobalHistorySnapshotResponse {
  return {
    snapshot_date: date,
    total_wealth: total,
    stock_value: 1,
    crypto_value: 1,
    bank_value: 1,
    assets_value: 0,
    placements_value: 1,
    ...pockets,
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

  it('keeps an overdrawn brokerage account, so the lines still add up to the total', () => {
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

describe('referenceSnapshot', () => {
  it('skips a day missing a pocket held today, which would read as a gain', () => {
    const history = [
      snapshot('2026-09-26', 6000),
      snapshot('2026-09-27', 5000, { bank_value: 0 }),
    ]

    expect(referenceSnapshot(history, '2026-09-28', ['bank_value'])?.snapshot_date).toBe('2026-09-26')
  })

  it('never takes today or later as its own reference', () => {
    const history = [snapshot('2026-09-27', 6000), snapshot('2026-09-28', 6100)]

    expect(referenceSnapshot(history, '2026-09-28', [])?.snapshot_date).toBe('2026-09-27')
  })
})

describe('netWorthChanges', () => {
  const today = new Date(2026, 8, 28)

  it('measures from the last snapshot, the end of last month and of last year', () => {
    const history = [
      snapshot('2025-12-31', 5000),
      snapshot('2026-08-31', 6000),
      snapshot('2026-09-27', 6400),
    ]

    const changes = netWorthChanges(6500, history, [], today)

    expect(changes).toEqual([
      { key: 'lastSnapshot', since: '2026-09-27', diff: 100, percent: 100 / 6400 * 100 },
      { key: 'month', since: '2026-08-31', diff: 500, percent: 500 / 6000 * 100 },
      { key: 'year', since: '2025-12-31', diff: 1500, percent: 30 },
    ])
  })

  it('does not repeat a change resting on the same snapshot', () => {
    const history = [snapshot('2026-08-31', 6000)]

    expect(netWorthChanges(6500, history, [], today).map((c) => c.key)).toEqual(['lastSnapshot'])
  })

  it('gives no percentage over a zero reference', () => {
    const history = [snapshot('2026-09-27', 0)]

    expect(netWorthChanges(100, history, [], today)[0]?.percent).toBeNull()
  })

  it('asks the reference for every pocket the live total holds', () => {
    const held = heldPockets(buildComposition(statistics(), { bankEnabled: true, wealthEnabled: true }))

    expect(held.sort()).toEqual(['bank_value', 'crypto_value', 'placements_value', 'stock_value'])
  })
})
