import { describe, expect, it } from 'vitest'

import {
  ALL, RECURRING, answerHint, answerLabel, contributionBadge, contributionNote, matchesCashflowType, matchesOperationType,
  needsReview, typeSourceTitle,
} from '@/utils/cashflowTypes'
import type { BankTransactionItem } from '@/types'

function anOperation(overrides: Partial<BankTransactionItem> = {}): BankTransactionItem {
  return {
    id: 'tx-1', account_id: 'acc-1', account_name: 'Compte courant', operation_date: '2026-03-05',
    amount: 40, currency: 'EUR', is_credit: false, is_pending: false, label: 'VIR INST ROUKINE EMILIEN',
    transfer_account_id: null, transfer_account_name: null, transfer_id: null, transfer_status: null,
    operation_type: 'TRANSFER', cashflow_type: 'EXPENSE', type_source: 'default', type_rule_id: null,
    flow_question: null, contribution: null, recurring: null, recurring_question: null, ...overrides,
  }
}

describe('answerLabel', () => {
  it('reads a credit answer as what it means for money coming in', () => {
    expect(answerLabel('EXPENSE', true)).toBe('Remboursement')
    expect(answerLabel('SAVING', true)).toBe("Reprise d'épargne")
    expect(answerLabel('INVESTMENT', true)).toBe("Reprise d'investissement")
  })

  it('reads a debit answer as the type itself', () => {
    expect(answerLabel('EXPENSE', false)).toBe('Dépense')
    expect(answerLabel('SAVING', false)).toBe('Épargne')
  })
})

describe('filters', () => {
  it('keeps every operation until a type is picked', () => {
    expect(matchesCashflowType(anOperation(), ALL)).toBe(true)
    expect(matchesCashflowType(anOperation(), 'SAVING')).toBe(false)
    expect(matchesCashflowType(anOperation({ cashflow_type: 'SAVING' }), 'SAVING')).toBe(true)
  })

  it('keeps only the operations of a recurring payment or income under Récurrent, whatever their type', () => {
    const tag = {
      id: null, key: 'k', direction: 'expense', name: 'EDF', cadence: 'monthly', role: 'regular', state: 'auto',
    } as const
    const salary = anOperation({
      is_credit: true, cashflow_type: 'INCOME', recurring: { ...tag, direction: 'income', name: 'Employeur' },
    })
    expect(matchesCashflowType(anOperation(), RECURRING)).toBe(false)
    expect(matchesCashflowType(anOperation({ recurring: tag }), RECURRING)).toBe(true)
    expect(matchesCashflowType(salary, RECURRING)).toBe(true)
    // Still an income under its type: the mark does not move it.
    expect(matchesCashflowType(salary, 'INCOME')).toBe(true)
    expect(matchesCashflowType(salary, 'EXPENSE')).toBe(false)
  })

  it('filters on the payment means', () => {
    expect(matchesOperationType(anOperation(), 'TRANSFER')).toBe(true)
    expect(matchesOperationType(anOperation(), 'CARD')).toBe(false)
  })
})

describe('needsReview', () => {
  it('holds a suggested pair, a flow question and a recurring question, nothing else', () => {
    const question = {
      direction: 'expense', cadence: 'monthly', amount: 21.6, variable: false, occurrence_count: 4, since: '2026-06-02',
      annual_estimate: 259.2, renamed_from: [],
    } as const
    expect(needsReview(anOperation())).toBe(false)
    expect(needsReview(anOperation({ transfer_status: 'suggested' }))).toBe(true)
    expect(needsReview(anOperation({ flow_question: { choices: ['EXPENSE'], operation_count: 3 } }))).toBe(true)
    expect(needsReview(anOperation({ transfer_status: 'recurring' }))).toBe(false)
    expect(needsReview(anOperation({ recurring_question: question }))).toBe(true)
    expect(needsReview(anOperation({
      is_credit: true, cashflow_type: 'INCOME', recurring_question: { ...question, direction: 'income' },
    }))).toBe(true)
  })
})

describe('answerHint', () => {
  it('says what the answer does to the figures, on both sides', () => {
    expect(answerHint('EXPENSE', true)).toContain('Déduit des dépenses')
    expect(answerHint('EXPENSE', false)).toContain('Compté dans vos dépenses')
    expect(answerHint('SAVING', true)).toContain('Repris')
    expect(answerHint('SAVING', false)).toBe('Compté dans votre épargne.')
    expect(answerHint('NEUTRAL', true)).toBe(answerHint('NEUTRAL', false))
  })
})

describe('contributionNote', () => {
  const deposit = { account_name: 'PEA', day: '2026-03-07', amount: 200, is_deposit: true, exact: false }
  const euros = (value: number) => `${value.toFixed(2).replace('.', ',')} €`

  it('says nothing of a deposit of the very amount on the very day: the badge does', () => {
    expect(contributionNote({ ...deposit, exact: true }, 200, euros, '5 mars')).toBeNull()
    expect(contributionBadge({ ...deposit, exact: true })).toBe('vers PEA')
  })

  it('names the fee a platform kept', () => {
    expect(contributionNote({ ...deposit, amount: 199, exact: true }, 200, euros, '5 mars')).toBe(
      '199,00 € arrivés sur PEA, 1,00 € de frais.',
    )
  })

  it('offers a nearby deposit without deciding for the user', () => {
    expect(contributionNote(deposit, 200, euros, '7 mars')).toBe(
      'Un versement de 200,00 € sur PEA le 7 mars pourrait être celui-ci.',
    )
  })

  it('reads a withdrawal as money coming back', () => {
    const withdrawal = { ...deposit, is_deposit: false }
    expect(contributionNote(withdrawal, 80, euros, '5 mars')).toContain('retrait de 200,00 € depuis PEA')
    expect(contributionBadge({ ...withdrawal, exact: true })).toBe('depuis PEA')
  })
})

describe('typeSourceTitle', () => {
  it('separates what was detected, deduced and chosen', () => {
    expect(typeSourceTitle('default')).toContain('détecté')
    expect(typeSourceTitle('contribution')).toContain('déduit')
    expect(typeSourceTitle('override')).toContain('choisi')
    expect(typeSourceTitle('rule')).toContain('choisi')
  })
})
