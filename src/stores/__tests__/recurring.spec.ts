import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { apiClient } from '@/api/client'
import { useBankStore } from '@/stores/bank'
import { useRecurringStore } from '@/stores/recurring'
import type { BankRecurringItem, BankRecurringResponse } from '@/types'

vi.mock('@/api/client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

function aSeries(overrides: Partial<BankRecurringItem> = {}): BankRecurringItem {
  return {
    id: null, key: 'k-1', direction: 'expense', transaction_id: 'tx-1', name: 'NETFLIX', nature: null,
    state: 'candidate', status: 'active', covered_until: null, cadence: 'monthly', variable: false, amount: 40,
    currency: 'EUR', monthly_equivalent: 40, annual_estimate: 480, paid_last_12_months: 240, paid_total: 240, paid_by_month: [],
    first_date: '2025-10-05', since_at_least: false, last_date: '2026-03-05', next_date: '2026-04-05',
    occurrence_count: 6, extra_count: 0, accounts: ['Compte courant'], price_changes: [], episodes: [], renamed: [],
    refunds: { total: 0, items: [] }, ended_on: null, retyped: null,
    ...overrides,
  }
}

function aList(items: BankRecurringItem[]): BankRecurringResponse {
  return { direction: 'expense', currency: 'EUR', monthly_total: 0, annual_total: 0, items }
}

describe('useRecurringStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.mocked(apiClient.get).mockResolvedValue({ total: 0, months: [] })
  })

  it('answers for the series of an operation, and makes the figures stale', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ id: 'd1' })
    const bank = useBankStore()

    const item = await useRecurringStore().decide('tx-1', 'confirm')

    expect(apiClient.post).toHaveBeenCalledWith('/banking/recurring/decisions', {
      transaction_id: 'tx-1', decision: 'confirm', name: undefined,
    })
    expect(item?.id).toBe('d1')
    expect(bank.dataRevision).toBe(1)
    expect(apiClient.get).toHaveBeenCalledWith('/banking/transfer-questions')
  })

  it('edits a decided one by its id', async () => {
    await useRecurringStore().update('d 1', { ended_on: '2026-09-18' })

    expect(apiClient.patch).toHaveBeenCalledWith('/banking/recurring/d%201', { ended_on: '2026-09-18' })
    expect(useBankStore().dataRevision).toBe(1)
  })

  it('lists each direction apart, payments by default', async () => {
    const store = useRecurringStore()
    vi.mocked(apiClient.get).mockResolvedValueOnce({ direction: 'expense', items: [] })
    vi.mocked(apiClient.get).mockResolvedValueOnce({ direction: 'income', items: [] })

    await store.fetchList()
    await store.fetchList('income')

    expect(apiClient.get).toHaveBeenCalledWith('/banking/recurring?direction=expense')
    expect(apiClient.get).toHaveBeenCalledWith('/banking/recurring?direction=income')
    expect(store.lists.expense?.direction).toBe('expense')
    expect(store.lists.income?.direction).toBe('income')
  })

  it('marks an operation the detection missed', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ id: 'd1', direction: 'income' })

    await useRecurringStore().mark('tx-1')

    expect(apiClient.post).toHaveBeenCalledWith('/banking/recurring', {
      transaction_id: 'tx-1', cadence: undefined, name: undefined,
    })
    expect(useBankStore().dataRevision).toBe(1)
  })

  it('confirms one counted without asking before editing it', async () => {
    const store = useRecurringStore()
    vi.mocked(apiClient.post).mockResolvedValue({ id: 'd2' })

    expect(await store.decisionId({ id: 'd1', transaction_id: 'tx-1' })).toBe('d1')
    expect(apiClient.post).not.toHaveBeenCalled()
    expect(await store.decisionId({ id: null, transaction_id: 'tx-2' })).toBe('d2')
    expect(apiClient.post).toHaveBeenCalledWith('/banking/recurring/decisions', {
      transaction_id: 'tx-2', decision: 'confirm', name: undefined,
    })
  })

  it('attaches and detaches an operation', async () => {
    const store = useRecurringStore()

    await store.correct('d1', 'tx-1', 'exclude')
    await store.correct('d1', 'tx-2', 'include')

    expect(apiClient.post).toHaveBeenCalledWith('/banking/recurring/d1/operations', { transaction_id: 'tx-1', action: 'exclude' })
    expect(apiClient.post).toHaveBeenCalledWith('/banking/recurring/d1/operations', { transaction_id: 'tx-2', action: 'include' })
  })

  it('merges with the other by its decision, or through its operation when never decided', async () => {
    const store = useRecurringStore()

    await store.merge('d1', { id: 'd2', transaction_id: 'tx-2' })
    await store.merge('d1', { id: null, transaction_id: 'tx-3' })

    expect(apiClient.post).toHaveBeenCalledWith('/banking/recurring/d1/merge', { other_id: 'd2' })
    expect(apiClient.post).toHaveBeenCalledWith('/banking/recurring/d1/merge', { other_transaction_id: 'tx-3' })
  })

  it('lets the refusal of a payment merged with an income through, figures untouched', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new Error('Un paiement et un revenu ne se fusionnent pas.'))

    await expect(useRecurringStore().merge('d1', { id: 'd2', transaction_id: 'tx-2' }))
      .rejects.toThrow('Un paiement et un revenu ne se fusionnent pas.')
    expect(useBankStore().dataRevision).toBe(0)
  })

  it('reaches the operations of a series never decided through one of them', async () => {
    const store = useRecurringStore()
    vi.mocked(apiClient.get).mockResolvedValue([])

    await store.fetchOperations({ id: 'd1', transaction_id: 'tx-1' })
    await store.fetchOperations({ id: null, transaction_id: 'tx 2' })

    expect(apiClient.get).toHaveBeenCalledWith('/banking/recurring/d1/operations')
    expect(apiClient.get).toHaveBeenCalledWith('/banking/recurring/operations?transaction_id=tx%202')
  })

  it('shows a yes said in its tab at once, and the reading asked once it is stored as it comes', async () => {
    const store = useRecurringStore()
    vi.mocked(apiClient.get).mockResolvedValueOnce(aList([aSeries()]))
    await store.fetchList()
    let stored!: (value: unknown) => void
    vi.mocked(apiClient.post).mockReturnValueOnce(new Promise((resolve) => { stored = resolve }))

    const answered = store.answer(store.lists.expense!.items[0]!, 'confirm')

    expect(store.lists.expense!.items[0]!.state).toBe('confirmed')
    stored({ id: 'd1' })
    await answered
    expect(store.lists.expense!.items[0]!.state).toBe('confirmed')
    vi.mocked(apiClient.get).mockResolvedValueOnce(aList([aSeries({ id: 'd1', key: 'd1', state: 'confirmed', name: 'Netflix' })]))
    await store.fetchList()
    expect(store.lists.expense!.items[0]).toMatchObject({ key: 'd1', name: 'Netflix' })
  })

  it('puts the list back when the answer fails', async () => {
    const store = useRecurringStore()
    vi.mocked(apiClient.get).mockResolvedValueOnce(aList([aSeries()]))
    await store.fetchList()
    vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('Hors ligne.'))

    await expect(store.answer(store.lists.expense!.items[0]!, 'refuse')).rejects.toThrow('Hors ligne.')
    expect(store.lists.expense!.items[0]!.state).toBe('candidate')
    expect(useBankStore().dataRevision).toBe(0)
  })

  it('renames a decided one by its id, and gives one never decided its name with the yes', async () => {
    const store = useRecurringStore()
    vi.mocked(apiClient.get).mockResolvedValueOnce(aList([aSeries({ id: 'd1', key: 'd1', state: 'confirmed' }), aSeries()]))
    await store.fetchList()
    const [decided, candidate] = store.lists.expense!.items
    vi.mocked(apiClient.post).mockResolvedValue({ id: 'd2' })

    await store.rename(decided!, 'Netflix')
    await store.rename(candidate!, 'Spotify')

    expect(apiClient.patch).toHaveBeenCalledWith('/banking/recurring/d1', { name: 'Netflix' })
    expect(apiClient.post).toHaveBeenCalledWith('/banking/recurring/decisions', {
      transaction_id: 'tx-1', decision: 'confirm', name: 'Spotify',
    })
    expect(store.lists.expense!.items.map((item) => [item.name, item.state]))
      .toEqual([['Netflix', 'confirmed'], ['Spotify', 'confirmed']])
  })
})
