import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAnalysisStore } from '@/stores/analysis'

vi.mock('@/api/client', () => ({
  apiClient: { get: vi.fn() },
}))

vi.mock('@/services/cache', () => ({
  getOrFetchCached: vi.fn((_key: string, fetcher: () => unknown) => fetcher()),
  invalidateCacheKey: vi.fn(),
}))

describe('useAnalysisStore', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('stores the payload returned by the API', async () => {
    const { apiClient } = await import('@/api/client')
    vi.mocked(apiClient.get).mockResolvedValue({
      period_start: '2026-01-01',
      period_end: '2026-07-29',
      days: 210,
      benchmark_asset_key: 'IE00B4L5Y983',
      investor_gap: null,
    })

    const store = useAnalysisStore()
    await store.fetchAnalytics()

    expect(apiClient.get).toHaveBeenCalledWith('/analytics/investor')
    expect(store.data?.days).toBe(210)
    expect(store.error).toBeNull()
  })

  it('surfaces the error message and leaves data untouched', async () => {
    const { apiClient } = await import('@/api/client')
    vi.mocked(apiClient.get).mockRejectedValue(new Error('boom'))

    const store = useAnalysisStore()
    await store.fetchAnalytics()

    expect(store.data).toBeNull()
    expect(store.error).toBe('boom')
    expect(store.isLoading).toBe(false)
  })
})
