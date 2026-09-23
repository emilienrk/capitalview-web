import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { apiClient } from '@/api/client'
import { useBankStore } from '@/stores/bank'
import { useRecurringStore } from '@/stores/recurring'

vi.mock('@/api/client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

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

  it('reaches the operations of a series never decided through one of them', async () => {
    const store = useRecurringStore()
    vi.mocked(apiClient.get).mockResolvedValue([])

    await store.fetchOperations({ id: 'd1', transaction_id: 'tx-1' })
    await store.fetchOperations({ id: null, transaction_id: 'tx 2' })

    expect(apiClient.get).toHaveBeenCalledWith('/banking/recurring/d1/operations')
    expect(apiClient.get).toHaveBeenCalledWith('/banking/recurring/operations?transaction_id=tx%202')
  })
})
