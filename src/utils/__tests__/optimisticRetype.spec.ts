import { describe, expect, it } from 'vitest'

import { applyToMonth, applyToQueue } from '@/utils/optimisticAnswers'
import { retypeEffect } from '@/utils/optimisticRetype'
import type { BankReviewQueue, BankTransactionItem, BankTransactionsResponse } from '@/types'

function anOperation(overrides: Partial<BankTransactionItem> = {}): BankTransactionItem {
  return {
    id: 'tx-1', account_id: 'acc-1', account_name: 'Compte courant', operation_date: '2026-03-05',
    amount: 40, currency: 'EUR', is_credit: false, is_pending: false, label: 'CB BOULANGERIE',
    transfer_account_id: null, transfer_account_name: null, transfer_id: null, transfer_status: null,
    cashflow_type: 'EXPENSE', type_source: 'default', type_rule_id: null,
    flow_question: null, contribution: null, asks_contribution: false, recurring: null, recurring_question: null,
    ...overrides,
  }
}

function asking(overrides: Partial<BankTransactionItem> = {}, count = 1, amount = 40): BankTransactionItem {
  return anOperation({ flow_question: { choices: ['EXPENSE', 'NEUTRAL'], operation_count: count, amount }, ...overrides })
}

function aMonth(transactions: BankTransactionItem[]): BankTransactionsResponse {
  return {
    period: '2026-03', currency: 'EUR', inflow: 1000, outflow: 600, net: 400,
    internal_transfers_excluded: 0, internal_transfers_amount: 0, transfer_questions: 1,
    reversals_excluded: 0, reversals_amount: 0, pending_count: 0, pending_inflow: 0, pending_outflow: 0,
    other_currencies: [], transactions,
  }
}

describe('a type chosen from the badge', () => {
  it('retypes an operation already typed by hand, alone, and nothing else', () => {
    const tx = anOperation({ type_source: 'override', cashflow_type: 'NEUTRAL' })
    const other = anOperation({ id: 'tx-2' })
    const effect = retypeEffect(tx, 'INCOME', 'operation', [tx, other])
    expect(effect.operations).toEqual({
      'tx-1': { flow_question: null, asks_contribution: false, cashflow_type: 'INCOME', type_source: 'override' },
    })
    expect(effect.settled).toEqual([])
    expect(effect.shrunk).toEqual({})
  })

  it('gives the label to its rule: the operation leaves its own type, the others read by default follow', () => {
    const tx = anOperation({ type_source: 'override', cashflow_type: 'NEUTRAL' })
    const kept = anOperation({ id: 'kept', type_source: 'override' })
    const follows = anOperation({ id: 'follows', operation_date: '2026-03-02' })
    const month = applyToMonth(aMonth([tx, kept, follows]), [retypeEffect(tx, 'NEUTRAL', 'label', [tx, kept, follows])])
    expect(month.transactions.map((op) => [op.id, op.cashflow_type, op.type_source])).toEqual([
      ['tx-1', 'NEUTRAL', 'rule'], ['kept', 'EXPENSE', 'override'], ['follows', 'NEUTRAL', 'rule'],
    ])
  })

  it('closes the question another operation of the label carries in the month', () => {
    const tx = anOperation({ type_source: 'rule', type_rule_id: 'r-1' })
    const carrier = asking({ id: 'carrier', operation_date: '2026-03-20' }, 2, 80)
    const effect = retypeEffect(tx, 'NEUTRAL', 'label', [tx, carrier])
    expect(effect.settled).toEqual([{ ids: ['carrier'], day: '2026-03-20' }])
    const month = applyToMonth(aMonth([tx, carrier]), [effect])
    expect(month.transfer_questions).toBe(0)
    expect(month.transactions.find((op) => op.id === 'carrier')?.flow_question).toBeNull()
  })

  it('leaves the question of an operation the rule does not reach', () => {
    const tx = anOperation()
    const paired = asking({ id: 'paired', transfer_status: 'suggested', transfer_id: 'x' })
    expect(retypeEffect(tx, 'NEUTRAL', 'label', [tx, paired]).settled).toEqual([])
  })

  it('takes the question it carries out of the À trier queue', () => {
    const tx = asking()
    const queue: BankReviewQueue = {
      total_amount: 40, total_count: 1, recurring_count: 0, unfaced: [],
      years: [{ year: 2026, amount: 40, count: 1 }],
      questions: [{ kind: 'flow', group: 'tx-1', transaction: tx, amount: 40, operation_count: 1 }],
    }
    const after = applyToQueue(queue, [retypeEffect(tx, 'NEUTRAL', 'operation')])
    expect(after.questions).toEqual([])
    expect(after.total_count).toBe(0)
  })
})
