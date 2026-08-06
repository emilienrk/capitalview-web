import { defineStore } from 'pinia'
import { ref } from 'vue'
import { apiClient } from '@/api/client'
import { getOrFetchCached, invalidateCacheKey } from '@/services/cache'
import type { AnalysedAsset, InvestorAnalyticsResponse } from '@/types'

// Behavioural metrics move on the scale of weeks, not seconds.
const CACHE_TTL_MS = 60 * 60 * 1000
const CACHE_KEY = 'analysis:investor'
// The traded lines change with every import, and the list is cheap to rebuild.
const ASSETS_CACHE_TTL_MS = 5 * 60 * 1000
const ASSETS_CACHE_KEY = 'analysis:assets'

export const useAnalysisStore = defineStore('analysis', () => {
  const data = ref<InvestorAnalyticsResponse | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const assets = ref<AnalysedAsset[]>([])
  const isLoadingAssets = ref(false)

  async function fetchAnalytics(force = false): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      data.value = await getOrFetchCached<InvestorAnalyticsResponse>(
        CACHE_KEY,
        () => apiClient.get<InvestorAnalyticsResponse>('/analytics/investor'),
        CACHE_TTL_MS,
        force,
      )
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Erreur lors du chargement de l'analyse"
    } finally {
      isLoading.value = false
    }
  }

  /**
   * The lines to pick from in the settings forms.
   *
   * Deliberately not part of the analysis payload: the forms need this list
   * even when the analysis has too little history to return a single block,
   * and a failure here must leave the form usable rather than break it — the
   * picker falls back to free ISIN entry on an empty list.
   */
  async function fetchAssets(force = false): Promise<void> {
    isLoadingAssets.value = true
    try {
      assets.value = await getOrFetchCached<AnalysedAsset[]>(
        ASSETS_CACHE_KEY,
        () => apiClient.get<AnalysedAsset[]>('/analytics/assets'),
        ASSETS_CACHE_TTL_MS,
        force,
      )
    } catch {
      assets.value = []
    } finally {
      isLoadingAssets.value = false
    }
  }

  function reset(): void {
    data.value = null
    error.value = null
    invalidateCacheKey(CACHE_KEY)
  }

  return {
    data,
    isLoading,
    error,
    assets,
    isLoadingAssets,
    fetchAnalytics,
    fetchAssets,
    reset,
  }
})
