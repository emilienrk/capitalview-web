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

  it('keeps the previously loaded data when a forced refresh fails', async () => {
    const { apiClient } = await import('@/api/client')
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      period_start: '2026-01-01',
      period_end: '2026-07-29',
      days: 210,
      benchmark_asset_key: 'IE00B4L5Y983',
      investor_gap: null,
    })

    const store = useAnalysisStore()
    await store.fetchAnalytics()
    expect(store.data?.days).toBe(210)

    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('boom'))
    await store.fetchAnalytics(true)

    expect(store.data?.days).toBe(210)
    expect(store.error).toBe('boom')
    expect(store.isLoading).toBe(false)
  })

  it('loads the traded lines the settings pickers offer', async () => {
    const { apiClient } = await import('@/api/client')
    vi.mocked(apiClient.get).mockResolvedValue([
      {
        asset_key: 'IE00B4L5Y983',
        symbol: 'IWDA.AS',
        name: 'iShares Core MSCI World',
        held: true,
        invested_eur: '12000',
        first_bought: '2024-01-05',
        last_activity: '2025-06-05',
      },
    ])

    const store = useAnalysisStore()
    await store.fetchAssets()

    expect(apiClient.get).toHaveBeenCalledWith('/analytics/assets')
    expect(store.assets[0]?.name).toBe('iShares Core MSCI World')
  })

  it('leaves the pickers usable when the list cannot be fetched', async () => {
    // A failure here must not break the form: free ISIN entry still works.
    const { apiClient } = await import('@/api/client')
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('boom'))

    const store = useAnalysisStore()
    await store.fetchAssets()

    expect(store.assets).toEqual([])
    expect(store.error).toBeNull()
    expect(store.isLoadingAssets).toBe(false)
  })
})
