import { defineStore } from 'pinia'
import { ref } from 'vue'
import { apiClient } from '@/api/client'
import { getOrFetchCached, invalidateCacheKey } from '@/services/cache'
import type { AnalysedAsset, InvestorAnalyticsResponse, YearlyPerformanceResponse } from '@/types'

// Behavioural metrics move on the scale of weeks, not seconds. The API keeps
// the finished analysis for a month on its side (`computed_at` on the payload);
// this hour only spares the round trip.
const CACHE_TTL_MS = 60 * 60 * 1000
const CACHE_KEY = 'analysis:investor'
// The traded lines change with every import, and the list is cheap to rebuild.
const ASSETS_CACHE_TTL_MS = 5 * 60 * 1000
const ASSETS_CACHE_KEY = 'analysis:assets'
const YEARLY_CACHE_KEY = 'analysis:yearly'

function withRefresh(path: string, force: boolean): string {
  return force ? `${path}?refresh=true` : path
}

export const useAnalysisStore = defineStore('analysis', () => {
  const data = ref<InvestorAnalyticsResponse | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const assets = ref<AnalysedAsset[]>([])
  const isLoadingAssets = ref(false)
  const yearly = ref<YearlyPerformanceResponse | null>(null)
  const yearlyError = ref<string | null>(null)

  /**
   * `force` also asks the API to replay rather than serve its stored payload:
   * the only thing a user can mean by "recalculer" is both caches at once.
   */
  async function fetchAnalytics(force = false): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      data.value = await getOrFetchCached<InvestorAnalyticsResponse>(
        CACHE_KEY,
        () => apiClient.get<InvestorAnalyticsResponse>(withRefresh('/analytics/investor', force)),
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

  /** Its own request: a few snapshots read, not the full behavioural replay. */
  async function fetchYearly(force = false): Promise<void> {
    yearlyError.value = null
    try {
      yearly.value = await getOrFetchCached<YearlyPerformanceResponse>(
        YEARLY_CACHE_KEY,
        () => apiClient.get<YearlyPerformanceResponse>(withRefresh('/analytics/yearly', force)),
        CACHE_TTL_MS,
        force,
      )
    } catch (e) {
      yearlyError.value = e instanceof Error ? e.message : 'Erreur lors du chargement des années'
    }
  }

  /** Both payloads replayed on the server, whatever either cache holds. */
  async function recompute(): Promise<void> {
    await Promise.all([fetchAnalytics(true), fetchYearly(true)])
  }

  function reset(): void {
    data.value = null
    error.value = null
    yearly.value = null
    invalidateCacheKey(CACHE_KEY)
    invalidateCacheKey(YEARLY_CACHE_KEY)
  }

  return {
    data,
    isLoading,
    error,
    assets,
    isLoadingAssets,
    fetchAnalytics,
    fetchAssets,
    yearly,
    yearlyError,
    fetchYearly,
    recompute,
    reset,
  }
})
