import { describe, expect, it } from 'vitest'

import {
  ALL, answerHint, answerLabel, contributionNote, matchesCashflowType, matchesOperationType, needsReview,
  typeSourceTitle,
} from '@/utils/cashflowTypes'
import type { BankTransactionItem } from '@/types'

function anOperation(overrides: Partial<BankTransactionItem> = {}): BankTransactionItem {
  return {
    id: 'tx-1', account_id: 'acc-1', account_name: 'Compte courant', operation_date: '2026-03-05',
    amount: 40, currency: 'EUR', is_credit: false, is_pending: false, label: 'VIR INST ROUKINE EMILIEN',
    transfer_account_id: null, transfer_account_name: null, transfer_id: null, transfer_status: null,
    operation_type: 'TRANSFER', cashflow_type: 'EXPENSE', type_source: 'default', type_rule_id: null,
    flow_question: null, contribution: null, ...overrides,
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

  it('filters on the payment means', () => {
    expect(matchesOperationType(anOperation(), 'TRANSFER')).toBe(true)
    expect(matchesOperationType(anOperation(), 'CARD')).toBe(false)
  })
})

describe('needsReview', () => {
  it('holds a suggested pair and a flow question, nothing else', () => {
    expect(needsReview(anOperation())).toBe(false)
    expect(needsReview(anOperation({ transfer_status: 'suggested' }))).toBe(true)
    expect(needsReview(anOperation({ flow_question: { choices: ['EXPENSE'], operation_count: 3 } }))).toBe(true)
    expect(needsReview(anOperation({ transfer_status: 'recurring' }))).toBe(false)
  })
})

describe('answerHint', () => {
  it('says what the answer does to the figures, on both sides', () => {
    expect(answerHint('EXPENSE', true)).toContain('Déduit des dépenses')
    expect(answerHint('EXPENSE', false)).toContain('Compté dans vos dépenses')
    expect(answerHint('SAVING', true)).toContain('Repris')
    expect(answerHint('SAVING', false)).toContain('Mis de côté')
    expect(answerHint('NEUTRAL', true)).toBe(answerHint('NEUTRAL', false))
  })
})

describe('contributionNote', () => {
  const deposit = { account_name: 'PEA', day: '2026-03-07', amount: 200, is_deposit: true, exact: false }

  it('names the deposit it was recognised as, on the very day', () => {
    expect(contributionNote({ ...deposit, exact: true }, '200,00 €', '5 mars')).toBe(
      'Reconnu : versement de 200,00 € sur PEA, le même jour.',
    )
  })

  it('offers a nearby deposit without deciding for the user', () => {
    expect(contributionNote(deposit, '200,00 €', '7 mars')).toBe(
      'Un versement de 200,00 € sur PEA le 7 mars pourrait correspondre.',
    )
  })

  it('reads a withdrawal as money coming back', () => {
    expect(contributionNote({ ...deposit, is_deposit: false, exact: true }, '80,00 €', '5 mars')).toContain(
      'retrait de 80,00 € depuis PEA',
    )
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
