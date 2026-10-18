import { describe, expect, it } from 'vitest'

import {
  applyToMonth, applyToQuestionCounts, applyToQueue, applyToRecurringList, contributionAnswerEffect,
  recurringAnswerEffect, renameEffect, seriesAnswerEffect, transferAnswerEffect, typeAnswerEffect, waitingOn,
} from '@/utils/optimisticAnswers'
import type {
  BankRecurringItem, BankRecurringResponse, BankReviewItem, BankReviewQueue, BankTransactionItem,
  BankTransactionsResponse, BankTransferQuestionsResponse,
} from '@/types'

function anOperation(overrides: Partial<BankTransactionItem> = {}): BankTransactionItem {
  return {
    id: 'tx-1', account_id: 'acc-1', account_name: 'Compte courant', operation_date: '2026-03-05',
    amount: 40, currency: 'EUR', is_credit: false, is_pending: false, label: 'VIR INST ROUKINE EMILIEN',
    transfer_account_id: null, transfer_account_name: null, transfer_id: null, transfer_status: null,
    cashflow_type: 'EXPENSE', type_source: 'default', type_rule_id: null,
    flow_question: null, contribution: null, asks_contribution: false, recurring: null, recurring_question: null,
    ...overrides,
  }
}

function asking(overrides: Partial<BankTransactionItem> = {}, count = 1, amount = 40): BankTransactionItem {
  return anOperation({ flow_question: { choices: ['EXPENSE', 'NEUTRAL'], operation_count: count, amount }, ...overrides })
}

function aPair(debit: Partial<BankTransactionItem> = {}): [BankTransactionItem, BankTransactionItem] {
  const pair = { transfer_status: 'suggested' as const, transfer_label: 'VIR RECU', together_type: 'NEUTRAL' as const }
  return [
    anOperation({
      id: 'out', amount: 100, transfer_id: 'in', transfer_account_id: 'acc-2', transfer_account_name: 'Livret',
      transfer_date: '2026-03-06', ...pair, ...debit,
    }),
    anOperation({
      id: 'in', account_id: 'acc-2', amount: 100, is_credit: true, operation_date: '2026-03-06', transfer_id: 'out',
      transfer_account_id: 'acc-1', transfer_account_name: 'Compte courant', transfer_date: '2026-03-05', ...pair,
    }),
  ]
}

function facing(exact = true) {
  return { id: 'dep', account_name: 'PEA', day: '2026-03-05', amount: 40, is_deposit: true, exact }
}

function aQueue(questions: BankReviewItem[]): BankReviewQueue {
  const total = questions.reduce((sum, q) => sum + Number(q.amount), 0)
  return {
    total_amount: total, total_count: questions.length, recurring_count: 0, unfaced: [], questions,
    years: [{ year: 2026, amount: total, count: questions.length }],
  }
}

function item(tx: BankTransactionItem, group = tx.id): BankReviewItem {
  const count = tx.flow_question?.operation_count ?? 2
  const amount = tx.flow_question?.amount ?? tx.amount
  return { kind: tx.flow_question ? 'flow' : 'transfer', group, transaction: tx, amount, operation_count: count }
}

function aMonth(transactions: BankTransactionItem[], overrides: Partial<BankTransactionsResponse> = {}): BankTransactionsResponse {
  return {
    period: '2026-03', currency: 'EUR', inflow: 1000, outflow: 600, net: 400,
    internal_transfers_excluded: 0, internal_transfers_amount: 0, transfer_questions: 2,
    reversals_excluded: 0, reversals_amount: 0, pending_count: 0, pending_inflow: 0, pending_outflow: 0,
    other_currencies: [], transactions, ...overrides,
  }
}

describe('a type given to a question', () => {
  it('closes a question on its only operation', () => {
    const tx = asking()
    const queue = applyToQueue(aQueue([item(tx), item(asking({ id: 'tx-2' }, 1, 60))]), [
      typeAnswerEffect(tx, 'NEUTRAL', 'operation', ['tx-1']),
    ])
    expect(queue.questions.map((q) => q.transaction.id)).toEqual(['tx-2'])
    expect(queue.total_count).toBe(1)
    expect(queue.total_amount).toBe(60)
    expect(queue.years).toEqual([{ year: 2026, amount: 60, count: 1 }])
  })

  it('keeps a label answered on one operation in its place, one operation and its amount fewer, until the reload', () => {
    const tx = asking({}, 3, 120)
    const effect = typeAnswerEffect(tx, 'EXPENSE', 'operation', ['tx-1'])
    const queue = applyToQueue(aQueue([item(tx, 'group-a')]), [effect])
    expect(queue.questions).toHaveLength(1)
    expect(queue.questions[0]).toMatchObject({ group: 'group-a', operation_count: 2, amount: 80 })
    expect(queue.questions[0]!.transaction.flow_question).toMatchObject({ operation_count: 2, amount: 80 })
    expect(queue.total_count).toBe(1)
    expect(queue.total_amount).toBe(80)
    expect(waitingOn([effect]).has('tx-1')).toBe(true)
  })

  it('weighs the ticked operations by the group list opened', () => {
    const tx = asking({}, 3, 120)
    const members = [tx, anOperation({ id: 'tx-2', amount: 50 }), anOperation({ id: 'tx-3', amount: 30 })]
    const effect = typeAnswerEffect(tx, 'EXPENSE', 'operation', ['tx-2', 'tx-3'], members)
    expect(effect.shrunk).toEqual({ 'tx-1': { count: 2, amount: 80 } })
    expect(effect.settled).toEqual([])
    const all = typeAnswerEffect(tx, 'EXPENSE', 'operation', ['tx-1', 'tx-2', 'tx-3'], members)
    expect(all.settled).toEqual([{ ids: ['tx-1'], day: '2026-03-05' }])
  })

  it('closes the whole label with a rule, and types the same label read by default in the month', () => {
    const tx = asking({}, 3, 120)
    const sameLabel = anOperation({ id: 'tx-2' })
    const byHand = anOperation({ id: 'tx-3', type_source: 'override' })
    const elsewhere = anOperation({ id: 'tx-4', account_id: 'acc-2' })
    const effect = typeAnswerEffect(tx, 'SAVING', 'label', ['tx-1'], [], [tx, sameLabel, byHand, elsewhere])
    expect(Object.keys(effect.operations).sort()).toEqual(['tx-1', 'tx-2'])
    expect(effect.operations['tx-2']).toMatchObject({ cashflow_type: 'SAVING', type_source: 'rule' })
    expect(effect.settled).toHaveLength(1)
  })

  it('types the answered operation in the month and moves no total, the question gone with it', () => {
    const tx = asking()
    const month = applyToMonth(aMonth([tx, anOperation({ id: 'tx-2' })]), [typeAnswerEffect(tx, 'NEUTRAL', 'operation', ['tx-1'])])
    expect(month.transactions[0]).toMatchObject({ cashflow_type: 'NEUTRAL', type_source: 'override', flow_question: null })
    expect(month).toMatchObject({ inflow: 1000, outflow: 600, net: 400, transfer_questions: 1 })
  })

  it('keeps the month count when another operation of the label there may carry the question next', () => {
    const tx = asking({}, 3, 120)
    const earlier = anOperation({ id: 'tx-0', operation_date: '2026-03-02' })
    const rows = [tx, earlier]
    const month = applyToMonth(aMonth(rows), [typeAnswerEffect(tx, 'NEUTRAL', 'operation', ['tx-1'], [], rows)])
    expect(month.transactions[0]!.flow_question).toBeNull()
    expect(month.transactions[1]!.flow_question).toBeNull()
    expect(month.transfer_questions).toBe(2)
  })

  it('takes the question out of the month count when no other operation of the label is left there', () => {
    const tx = asking({}, 3, 120)
    const rows = [tx, anOperation({ id: 'tx-2', label: 'AUTRE' })]
    const effect = typeAnswerEffect(tx, 'NEUTRAL', 'operation', ['tx-1'], [], rows)
    expect(applyToMonth(aMonth(rows), [effect]).transfer_questions).toBe(1)
    // Still open elsewhere: neither the tab nor À trier lose it.
    expect(applyToQuestionCounts({ total: 3, recurring: 0, months: [] }, [effect]).total).toBe(3)
    expect(applyToQueue(aQueue([item(tx)]), [effect]).total_count).toBe(1)
  })
})

describe('yes or no to the deposit facing an operation', () => {
  const asked = { asks_contribution: true, contribution: facing() }

  it('settles, on a yes, the operations of the label facing their own deposit of the very day', () => {
    const tx = asking({ ...asked }, 2, 80)
    const sibling = anOperation({ id: 'tx-2', ...asked })
    const further = anOperation({ id: 'tx-3', ...asked, contribution: facing(false) })
    const otherLabel = anOperation({ id: 'tx-4', ...asked, label: 'AUTRE' })
    const effect = contributionAnswerEffect(tx, 'contribution', ['tx-1'], [], [tx, sibling, further, otherLabel])
    expect(Object.keys(effect.operations).sort()).toEqual(['tx-1', 'tx-2'])
    expect(effect.operations['tx-2']).toMatchObject({
      cashflow_type: 'INVESTMENT', type_source: 'contribution', asks_contribution: false,
    })
    expect(effect.settled).toEqual([{ ids: ['tx-1'], day: '2026-03-05' }])
  })

  it('keeps asking about the operations of its group facing a deposit of another day, once their list is known', () => {
    const tx = asking({ ...asked }, 3, 120)
    const members = [tx, anOperation({ id: 'tx-2', ...asked }), anOperation({ id: 'tx-3', amount: 25, ...asked, contribution: facing(false) })]
    const effect = contributionAnswerEffect(tx, 'contribution', ['tx-1'], members)
    expect(effect.settled).toEqual([])
    expect(effect.shrunk).toEqual({ 'tx-1': { count: 2, amount: 95 } })
  })

  it('takes, on a no, only the operations answered out of the question', () => {
    const tx = asking({ ...asked }, 2, 80)
    const effect = contributionAnswerEffect(tx, 'not_contribution', ['tx-1'])
    expect(effect.operations).toEqual({ 'tx-1': { flow_question: null, asks_contribution: false } })
    expect(effect.shrunk).toEqual({ 'tx-1': { count: 1, amount: 40 } })
  })

  it('finds the question on the last operation of the label when answered on another in the month', () => {
    const carrier = asking({ id: 'tx-9', operation_date: '2026-03-20', ...asked }, 2, 80)
    const tx = anOperation({ ...asked })
    const month = applyToMonth(aMonth([carrier, tx]), [contributionAnswerEffect(tx, 'not_contribution', ['tx-1'], [], [carrier, tx])])
    expect(month.transactions[0]!.flow_question).toMatchObject({ operation_count: 1, amount: 40 })
    expect(month.transactions[1]!.asks_contribution).toBe(false)
  })

  it('takes a pair offered apart when said to be the deposit: its question closes, the other side counts alone', () => {
    const [out, into] = aPair({ contribution: facing() })
    const effect = contributionAnswerEffect(out, 'contribution', ['out'])
    expect(effect.operations.out).toMatchObject({ transfer_status: null, transfer_id: null, cashflow_type: 'INVESTMENT' })
    expect(effect.operations.in).toMatchObject({ transfer_status: null, transfer_account_name: null })
    const month = applyToMonth(aMonth([out, into]), [effect])
    expect(month).toMatchObject({ inflow: 1000, outflow: 600, transfer_questions: 1 })
  })
})

describe('a pair offered', () => {
  it('leaves the totals on Ensemble, counted once among the transfers', () => {
    const [out, into] = aPair()
    const month = applyToMonth(aMonth([out, into]), [transferAnswerEffect(into, 'transfer')])
    expect(month).toMatchObject({
      inflow: 900, outflow: 500, net: 400, internal_transfers_excluded: 1, internal_transfers_amount: 100,
      transfer_questions: 1,
    })
    expect(month.transactions.map((tx) => tx.transfer_status)).toEqual(['confirmed', 'confirmed'])
  })

  it('takes only the side shown out of the totals of a month filtered on one account', () => {
    const [out] = aPair()
    const month = applyToMonth(aMonth([out]), [transferAnswerEffect(out, 'transfer')])
    expect(month).toMatchObject({ inflow: 1000, outflow: 500, internal_transfers_excluded: 1 })
  })

  it('keeps both sides counted on Pas ensemble, no longer paired', () => {
    const [out, into] = aPair()
    const month = applyToMonth(aMonth([out, into]), [transferAnswerEffect(out, 'not_transfer')])
    expect(month).toMatchObject({ inflow: 1000, outflow: 600, internal_transfers_excluded: 0, transfer_questions: 1 })
    expect(month.transactions.every((tx) => tx.transfer_id === null && tx.transfer_status === null)).toBe(true)
  })

  it('leaves the queue, held there by its debit whichever side was answered', () => {
    const [out, into] = aPair()
    const queue = applyToQueue(aQueue([item(out)]), [transferAnswerEffect(into, 'not_transfer')])
    expect(queue.questions).toEqual([])
    expect(queue.years).toEqual([])
  })
})

describe('the question counts', () => {
  const counts: BankTransferQuestionsResponse = {
    total: 3, recurring: 1, months: [{ period: '2026-02', count: 1 }, { period: '2026-03', count: 2 }],
  }

  it('lower the tab and the month of each question closed, once', () => {
    const [out, into] = aPair()
    const effect = transferAnswerEffect(into, 'transfer')
    expect(applyToQuestionCounts(counts, [effect, effect])).toEqual({
      total: 2, recurring: 1, months: [{ period: '2026-02', count: 1 }, { period: '2026-03', count: 1 }],
    })
    expect(out.id).toBe(effect.settled[0]!.ids[0])
  })

  it('stay as they are when a question is only answered on part of its operations', () => {
    const tx = asking({}, 3, 120)
    expect(applyToQuestionCounts(counts, [typeAnswerEffect(tx, 'EXPENSE', 'operation', ['tx-1'])])).toBe(counts)
  })
})

describe('a recurring answer', () => {
  const question = {
    direction: 'expense' as const, cadence: 'monthly' as const, amount: 40, variable: false, occurrence_count: 6,
    since: '2025-10-05', annual_estimate: 480, renamed_from: [],
  }

  function aSeries(overrides: Partial<BankRecurringItem> = {}): BankRecurringItem {
    return {
      id: null, key: 'k-1', direction: 'expense', transaction_id: 'tx-1', name: 'NETFLIX', nature: null,
      state: 'candidate', status: 'active', covered_until: null, cadence: 'monthly', variable: false, amount: 40,
      currency: 'EUR', monthly_equivalent: 40, annual_estimate: 480, paid_last_12_months: 240, paid_total: 240, paid_by_month: [],
      first_date: '2025-10-05', since_at_least: false, last_date: '2026-03-05', next_date: '2026-04-05',
      occurrence_count: 6, extra_count: 0, accounts: ['Compte courant'], price_changes: [], episodes: [], renamed: [],
      refunds: { total: 0, items: [] }, ended_on: null,
      ...overrides,
    }
  }

  function aList(items: BankRecurringItem[]): BankRecurringResponse {
    return { direction: 'expense', currency: 'EUR', monthly_total: 100, annual_total: 1200, items }
  }

  const counts: BankTransferQuestionsResponse = { total: 3, recurring: 2, months: [{ period: '2026-03', count: 3 }] }

  it('takes the question off the operation in the month, its other questions and the totals untouched', () => {
    const tx = asking({ recurring_question: question })
    const month = applyToMonth(aMonth([tx]), [recurringAnswerEffect(tx)])
    expect(month.transactions[0]).toMatchObject({ recurring_question: null, flow_question: tx.flow_question })
    expect(month).toMatchObject({ inflow: 1000, outflow: 600, transfer_questions: 2 })
  })

  it('takes it off the row of the queue, which stays for its other question, and lowers the recurring count', () => {
    const tx = asking({ recurring_question: question })
    const queue = applyToQueue({ ...aQueue([item(tx)]), recurring_count: 2 }, [recurringAnswerEffect(tx)])
    expect(queue).toMatchObject({ total_count: 1, total_amount: 40, recurring_count: 1 })
    expect(queue.questions[0]!.transaction.recurring_question).toBeNull()
    expect(queue.questions[0]!.transaction.flow_question).toEqual(tx.flow_question)
  })

  it('lowers the count of the Récurrent tab only', () => {
    const tx = anOperation({ recurring_question: question })
    expect(applyToQuestionCounts(counts, [recurringAnswerEffect(tx)])).toEqual({ ...counts, recurring: 1 })
  })

  it('does nothing on an operation asking no such question', () => {
    const effect = recurringAnswerEffect(anOperation())
    expect(effect).toEqual({ operations: {}, settled: [], shrunk: {} })
    expect(applyToQuestionCounts(counts, [effect])).toBe(counts)
  })

  it('confirms a candidate in its tab, with the name given, and closes its question', () => {
    const effect = seriesAnswerEffect(aSeries(), 'confirm', 'Netflix')
    const list = applyToRecurringList(aList([aSeries(), aSeries({ key: 'k-2', name: 'EDF' })]), [effect])
    expect(list.items.map((series) => [series.state, series.name])).toEqual([['confirmed', 'Netflix'], ['candidate', 'EDF']])
    expect(list).toMatchObject({ monthly_total: 100, annual_total: 1200 })
    expect(effect.operations).toEqual({ 'tx-1': { recurring_question: null } })
    expect(applyToQuestionCounts(counts, [effect]).recurring).toBe(1)
  })

  it('refuses a series already counted with no question to close', () => {
    const effect = seriesAnswerEffect(aSeries({ id: 'd1', state: 'confirmed' }), 'refuse')
    expect(applyToRecurringList(aList([aSeries({ id: 'd1', state: 'confirmed' })]), [effect]).items[0]!.state).toBe('refused')
    expect(effect.recurring).toBeUndefined()
    expect(applyToQuestionCounts(counts, [effect])).toBe(counts)
  })

  it('renames a decided series, and leaves the list as it is with no series answered', () => {
    const list = aList([aSeries({ id: 'd1', state: 'confirmed' })])
    expect(applyToRecurringList(list, [renameEffect(list.items[0]!, 'Netflix')]).items[0]!.name).toBe('Netflix')
    expect(applyToRecurringList(list, [recurringAnswerEffect(anOperation({ recurring_question: question }))])).toBe(list)
  })
})
