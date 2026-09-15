import { describe, expect, it } from 'vitest'

import { UNCATEGORIZED, matchesCategory, matchesOperationType } from '@/utils/bankCategories'
import type { BankTransactionItem } from '@/types'

function tx(overrides: Partial<BankTransactionItem> = {}): BankTransactionItem {
  return {
    id: 'tx', account_id: 'acc', account_name: 'Compte', operation_date: '2026-03-02', amount: 10, currency: 'EUR',
    is_credit: false, is_pending: false, label: 'CARTE CARREFOUR', transfer_account_id: null, transfer_account_name: null,
    transfer_id: null, transfer_status: null, operation_type: 'CARD', nature: 'EXPENSE', category_id: null,
    category_name: null, category_source: null, rule_id: null,
    ...overrides,
  }
}

describe('the "À ranger" filter', () => {
  it('keeps what nothing files', () => {
    expect(matchesCategory(tx(), UNCATEGORIZED)).toBe(true)
  })

  it('drops what a rule or the user filed', () => {
    expect(matchesCategory(tx({ category_id: 'c', category_name: 'Courses', category_source: 'ai_rule' }), UNCATEGORIZED)).toBe(false)
    expect(matchesCategory(tx({ category_id: 'c', category_name: 'Courses', category_source: 'user_rule' }), UNCATEGORIZED)).toBe(false)
  })

  it('drops an operation the user filed as "no category"', () => {
    expect(matchesCategory(tx({ category_source: 'manual' }), UNCATEGORIZED)).toBe(false)
  })

  it('drops a paired transfer, whose nature no category decides', () => {
    expect(matchesCategory(tx({ transfer_status: 'savings', nature: 'SAVING' }), UNCATEGORIZED)).toBe(false)
    expect(matchesCategory(tx({ transfer_status: 'refund', nature: 'NEUTRALIZED' }), UNCATEGORIZED)).toBe(false)
  })

  it('keeps a pair only offered to the user: it still counts as spending', () => {
    expect(matchesCategory(tx({ transfer_status: 'suggested' }), UNCATEGORIZED)).toBe(true)
  })
})

describe('the other filters', () => {
  it('match a category by id', () => {
    const filed = tx({ category_id: 'c-courses', category_name: 'Courses', category_source: 'user_rule' })
    expect(matchesCategory(filed, 'c-courses')).toBe(true)
    expect(matchesCategory(filed, 'c-loyer')).toBe(false)
    expect(matchesCategory(filed, 'all')).toBe(true)
  })

  it('match an operation type', () => {
    expect(matchesOperationType(tx(), 'CARD')).toBe(true)
    expect(matchesOperationType(tx(), 'TRANSFER')).toBe(false)
    expect(matchesOperationType(tx(), 'all')).toBe(true)
  })
})
