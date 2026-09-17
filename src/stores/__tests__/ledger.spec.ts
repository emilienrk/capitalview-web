import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { apiClient } from '@/api/client'
import { useLedgerStore } from '@/stores/ledger'
import type { BankLedger } from '@/types'

vi.mock('@/api/client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

function aLedger(label: string): BankLedger {
  return {
    currency: 'EUR',
    accounts: [{ id: 'a', name: 'Principal', type: 'CHECKING', institution: null, currency: 'EUR', balance: 0, first_day: null, covered_until: null, linked: true }],
    groups: [{ key: 'lidl', name: 'Lidl', is_credit: false }],
    rows: [{
      id: 'r', account: 0, group: 0, day: '2026-08-10', amount: 12, currency: 'EUR', is_credit: false, is_pending: false,
      label, operation_type: 'CARD', cashflow_type: 'EXPENSE', type_source: 'default', type_rule_id: null, transfer_status: null,
      counted: true, signed: 12, question: null, open: false,
    }],
  }
}

describe('useLedgerStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('reads the ledger and hands its rows back hydrated', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(aLedger('CARTE LIDL'))
    const store = useLedgerStore()

    await store.fetchLedger()

    expect(apiClient.get).toHaveBeenCalledWith('/banking/ledger')
    expect(store.entries.map((e) => [e.label, e.account.name, e.group.name, e.bankSigned])).toEqual([['CARTE LIDL', 'Principal', 'Lidl', -12]])
  })

  it('keeps only the answer to the last request', async () => {
    let answerFirst!: (value: BankLedger) => void
    vi.mocked(apiClient.get)
      .mockImplementationOnce(() => new Promise((resolve) => { answerFirst = resolve as (value: BankLedger) => void }))
      .mockResolvedValueOnce(aLedger('newer'))
    const store = useLedgerStore()

    const first = store.fetchLedger()
    await store.fetchLedger()
    expect(store.loading).toBe(false)
    answerFirst(aLedger('older'))
    await first

    expect(store.entries[0]?.label).toBe('newer')
    expect(store.loading).toBe(false)
  })

  it('says why it could not load', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('boom'))
    const store = useLedgerStore()
    await store.fetchLedger()
    expect(store.error).toBe('boom')
  })
})
