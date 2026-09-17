import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  changePercent, coverageNotice, defaultYear, monthlyFigures, openQuestionsNotice, readCashflowView, riseIsGood,
  savingsRateTone, writeCashflowView,
} from '@/utils/realCashflow'
import type { RealCashflowCoverageGap, RealCashflowTotals, RealCashflowYear } from '@/types'

function totals(expenses: number): RealCashflowTotals {
  return {
    income: 0, expenses, saving: 0, investment: 0, neutral: 0, net: -expenses, savings_rate: null, placed_rate: null,
  }
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

describe('openQuestionsNotice', () => {
  it('says nothing once every point is settled', () => {
    expect(openQuestionsNotice(0, '0,00 €')).toBeNull()
  })

  it('weighs what can still move the figures, then counts it', () => {
    expect(openQuestionsNotice(1, '400,00 €')).toBe('400,00 € restent à confirmer (1 opération) : ces chiffres peuvent encore changer.')
    expect(openQuestionsNotice(12, '3 200,00 €')).toBe('3 200,00 € restent à confirmer (12 opérations) : ces chiffres peuvent encore changer.')
  })
})

describe('changePercent', () => {
  it('reads the change against the previous figure', () => {
    expect(changePercent(110, 100)).toBe(10)
    expect(changePercent(90, 100)).toBe(-10)
  })

  it('reads a rise from a negative figure as a rise', () => {
    expect(changePercent(-50, -100)).toBe(50)
  })

  it('has nothing to compare against zero or nothing', () => {
    expect(changePercent(100, 0)).toBeNull()
    expect(changePercent(100, null)).toBeNull()
  })
})

describe('riseIsGood', () => {
  it('is bad news only for spending', () => {
    expect(riseIsGood('expenses')).toBe(false)
    expect(riseIsGood('saving')).toBe(true)
  })
})

describe('savingsRateTone', () => {
  it('warns under ten percent and alarms under zero', () => {
    expect(savingsRateTone(-0.1)).toBe('danger')
    expect(savingsRateTone(0)).toBe('warning')
    expect(savingsRateTone(9.9)).toBe('warning')
    expect(savingsRateTone(10)).toBe('success')
  })
})

describe('coverageNotice', () => {
  const gap: RealCashflowCoverageGap = {
    account_id: 'a', account_name: 'Livret A', first_day: '2025-01-28', covered_until: '2026-08-31',
    starts_late: true, ends_early: false,
  }

  it('says where the history starts, ends, or both', () => {
    expect(coverageNotice(gap, (day) => day)).toBe(
      "Livret A n'a d'opérations qu'à partir du 2025-01-28 : un virement vers ce compte hors de cette plage compte en dépense.",
    )
    expect(coverageNotice({ ...gap, ends_early: true }, (day) => day)).toBe(
      "Livret A n'a d'opérations qu'à partir du 2025-01-28 et n'est à jour qu'au 2026-08-31 : un virement vers ce compte hors de cette plage compte en dépense.",
    )
    expect(coverageNotice({ ...gap, starts_late: false, ends_early: true }, (day) => day)).toBe(
      "Livret A n'est à jour qu'au 2026-08-31 : un virement vers ce compte hors de cette plage compte en dépense.",
    )
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
    writeCashflowView('explore')
    expect(readCashflowView()).toBe('explore')
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
