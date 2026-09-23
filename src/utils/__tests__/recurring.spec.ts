import { describe, expect, it } from 'vitest'

import {
  NATURES, NATURE_LABELS, historyByNature, isCounted, isCurrent, isInTotal, questionText,
} from '@/utils/recurring'
import type { BankRecurringItem, BankRecurringQuestion } from '@/types'

const question: BankRecurringQuestion = {
  cadence: 'monthly', amount: 21.6, variable: false, occurrence_count: 4, since: '2025-07-03',
  annual_estimate: 259.2, renamed_from: [],
}

describe('questionText', () => {
  it('says the cadence, the amount and the month it started', () => {
    expect(questionText(question, '21,60 €')).toBe('Paiement mensuel · 21,60 € depuis juillet 2025 ?')
  })

  it('marks a varying amount as approximate', () => {
    expect(questionText({ ...question, cadence: 'annual', variable: true }, '90 €'))
      .toBe('Paiement annuel · ≈ 90 € depuis juillet 2025 ?')
  })
})

describe('natures', () => {
  it('holds a label for every nature the API can send', () => {
    expect(NATURES.map((nature) => NATURE_LABELS[nature])).not.toContain(undefined)
    expect(NATURES).toHaveLength(Object.keys(NATURE_LABELS).length)
  })

  it('adds up what each nature took, year by year, ended ones in', () => {
    const paid = (nature: BankRecurringItem['nature'], years: Array<[number, number]>) =>
      ({ nature, paid_by_year: years.map(([year, amount]) => ({ year, amount })) }) as BankRecurringItem

    expect(historyByNature([
      paid('housing', [[2025, 2280], [2026, 2280]]),
      paid('housing', [[2026, 1590]]),
      paid('software', [[2026, 216]]),
      paid(null, [[2026, 120]]),
      paid('sport', []),
    ])).toEqual([
      { nature: 'housing', total: 6150, years: [{ year: 2026, amount: 3870 }, { year: 2025, amount: 2280 }] },
      { nature: 'software', total: 216, years: [{ year: 2026, amount: 216 }] },
      // Not filed yet: gathered apart, never folded into a nature.
      { nature: null, total: 120, years: [{ year: 2026, amount: 120 }] },
    ])
  })

  it('keeps the unfiled ones last, however much they took', () => {
    const paid = (nature: BankRecurringItem['nature'], amount: number) =>
      ({ nature, paid_by_year: [{ year: 2026, amount }] }) as BankRecurringItem

    expect(historyByNature([paid(null, 9000), paid('software', 216), paid('housing', 2280)]).map((line) => line.nature))
      .toEqual(['housing', 'software', null])
  })
})

describe('sections', () => {
  const item = (state: BankRecurringItem['state'], status: BankRecurringItem['status']) =>
    ({ state, status }) as BankRecurringItem

  it('counts what was found sure enough or said yes to', () => {
    expect(isCounted(item('auto', 'active'))).toBe(true)
    expect(isCounted(item('confirmed', 'active'))).toBe(true)
    expect(isCounted(item('candidate', 'active'))).toBe(false)
    expect(isCounted(item('refused', 'active'))).toBe(false)
  })

  it('keeps a late or stale one current, not an ended one', () => {
    expect(isCurrent(item('auto', 'late'))).toBe(true)
    expect(isCurrent(item('confirmed', 'stale'))).toBe(true)
    expect(isCurrent(item('confirmed', 'ended'))).toBe(false)
    expect(isCurrent(item('candidate', 'active'))).toBe(false)
  })

  // The API adds up the active and stale ones only: the count beside the
  // total says the same, or it would name a sum it does not hold.
  it('counts in the total what the API adds up, a late one apart', () => {
    expect(isInTotal(item('auto', 'active'))).toBe(true)
    expect(isInTotal(item('confirmed', 'stale'))).toBe(true)
    expect(isInTotal(item('auto', 'late'))).toBe(false)
    expect(isInTotal(item('confirmed', 'ended'))).toBe(false)
  })
})
