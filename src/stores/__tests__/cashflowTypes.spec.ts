import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { apiClient } from '@/api/client'
import { useBankStore } from '@/stores/bank'
import { useCashflowTypesStore } from '@/stores/cashflowTypes'
import { getOrFetchCached } from '@/services/cache'

vi.mock('@/api/client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

describe('useCashflowTypesStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.mocked(apiClient.get).mockResolvedValue({ total: 0, months: [] })
  })

  it('answers a flow question by typing the label', async () => {
    vi.mocked(apiClient.put).mockResolvedValue({ transaction: {}, covered_count: 23 })

    const result = await useCashflowTypesStore().answerFlow('tx 1', 'SAVING')

    expect(apiClient.put).toHaveBeenCalledWith('/banking/transactions/tx%201/type', { type: 'SAVING', scope: 'label' })
    expect(result.covered_count).toBe(23)
  })

  it('makes every observed flow stale after a write', async () => {
    vi.mocked(apiClient.put).mockResolvedValue({ transaction: {}, covered_count: 1 })
    const bank = useBankStore()
    const fetcher = vi.fn().mockResolvedValue('fresh')
    await getOrFetchCached('bank:flows:transactions:2026-03', () => Promise.resolve('stale'), 60_000)

    await useCashflowTypesStore().setType('tx-1', 'NEUTRAL', 'operation')

    expect(apiClient.put).toHaveBeenCalledWith('/banking/transactions/tx-1/type', { type: 'NEUTRAL', scope: 'operation' })
    expect(bank.dataRevision).toBe(1)
    expect(await getOrFetchCached('bank:flows:transactions:2026-03', fetcher, 60_000)).toBe('fresh')
    expect(apiClient.get).toHaveBeenCalledWith('/banking/transfer-questions')
  })

  it('drops a deleted rule from the list', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce([{ id: 'r1' }, { id: 'r2' }])
    const store = useCashflowTypesStore()
    await store.fetchRules()

    await store.deleteRule('r1')

    expect(apiClient.delete).toHaveBeenCalledWith('/banking/type-rules/r1')
    expect(store.rules?.map((rule) => rule.id)).toEqual(['r2'])
  })
})
