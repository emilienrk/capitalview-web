import { describe, expect, it } from 'vitest'

import {
  NATURES, NATURE_LABELS, isCounted, isCurrent, isInTotal, questionText, roleNote,
} from '@/utils/recurring'
import type { BankRecurringItem, BankRecurringQuestion, RecurringNature } from '@/types'

const question: BankRecurringQuestion = {
  direction: 'expense', cadence: 'monthly', amount: 21.6, variable: false, occurrence_count: 4, since: '2025-07-03',
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

  it('asks about an income as an income', () => {
    expect(questionText({ ...question, direction: 'income', amount: 2150 }, '2 150,00 €'))
      .toBe('Revenu mensuel · 2 150,00 € depuis juillet 2025 ?')
  })
})

describe('roleNote', () => {
  it('reads a refund on an income as money taken back', () => {
    expect(roleNote('refund', 'expense')).toBe('remboursement')
    expect(roleNote('refund', 'income')).toBe('reprise')
  })

  it('says nothing of a plain due date, whatever the direction', () => {
    expect(roleNote('regular', 'income')).toBeNull()
    expect(roleNote('extra', 'income')).toBe('hors échéance')
  })
})

describe('natures', () => {
  it('holds a label for every nature the API can send', () => {
    const offered = new Set<RecurringNature>([...NATURES.expense, ...NATURES.income])
    expect([...offered].map((nature) => NATURE_LABELS[nature])).not.toContain(undefined)
    expect(offered.size).toBe(Object.keys(NATURE_LABELS).length)
  })

  // The API answers 422 on a nature of the other direction: the picker never offers one.
  it('offers each direction its own natures, and « Autre » to both', () => {
    expect(NATURES.income).toEqual(['salary', 'allowance', 'pension', 'rental', 'support', 'interest', 'other'])
    expect(NATURES.expense).not.toContain('salary')
    expect(NATURES.expense.filter((nature) => NATURES.income.includes(nature))).toEqual(['other'])
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
