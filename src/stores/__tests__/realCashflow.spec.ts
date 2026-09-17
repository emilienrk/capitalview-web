import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { apiClient } from '@/api/client'
import { clearCache } from '@/services/cache'
import { useRealCashflowStore } from '@/stores/realCashflow'

vi.mock('@/api/client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

describe('useRealCashflowStore.fetchCurrent', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    clearCache()
    vi.clearAllMocks()
  })

  it('reads the month in progress once, then from the cache unless forced', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ period: '2026-09', spent_to_date: 10 })
    const store = useRealCashflowStore()

    await store.fetchCurrent()
    await store.fetchCurrent()
    expect(apiClient.get).toHaveBeenCalledTimes(1)
    expect(apiClient.get).toHaveBeenCalledWith('/banking/real-cashflow/current')
    expect(store.current?.period).toBe('2026-09')

    await store.fetchCurrent(true)
    expect(apiClient.get).toHaveBeenCalledTimes(2)
  })

  it('shows nothing rather than an error over the year when it fails', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ period: '2026-09' }).mockRejectedValueOnce(new Error('boom'))
    const store = useRealCashflowStore()
    await store.fetchCurrent()

    await store.fetchCurrent(true)

    expect(store.error).toBeNull()
    expect(store.current).toBeNull()
  })
})
