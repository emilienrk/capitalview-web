import { afterEach, describe, expect, it, vi } from 'vitest'

import { defaultYear, monthlyFigures, readCashflowView, writeCashflowView } from '@/utils/realCashflow'
import type { RealCashflowTotals, RealCashflowYear } from '@/types'

function totals(expenses: number): RealCashflowTotals {
  return { income: 0, expenses, saving: 0, investment: 0, neutral: 0, net: -expenses }
}

describe('defaultYear', () => {
  it('opens on the current year once one of its months is over', () => {
    expect(defaultYear(new Date(2026, 1, 1))).toBe(2026)
    expect(defaultYear(new Date(2026, 8, 15))).toBe(2026)
  })

  it('opens on the previous year while only the current month exists', () => {
    expect(defaultYear(new Date(2026, 0, 31))).toBe(2025)
  })
})

describe('monthlyFigures', () => {
  const year = { monthly_mean: totals(200), monthly_median: totals(100) } as RealCashflowYear

  it('switches between the mean and the median', () => {
    expect(monthlyFigures(year, 'mean').expenses).toBe(200)
    expect(monthlyFigures(year, 'median').expenses).toBe(100)
  })
})

describe('the remembered view', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('comes back as it was left', () => {
    const stored = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => void stored.set(key, value),
    })
    writeCashflowView('real')
    expect(readCashflowView()).toBe('real')
  })

  it('falls back to the declared view when storage throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
    })
    expect(() => writeCashflowView('real')).not.toThrow()
    expect(readCashflowView()).toBe('planned')
  })
})
