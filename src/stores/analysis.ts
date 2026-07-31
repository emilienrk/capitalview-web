import { defineStore } from 'pinia'
import { ref } from 'vue'
import { apiClient } from '@/api/client'
import { getOrFetchCached, invalidateCacheKey } from '@/services/cache'
import type { InvestorAnalyticsResponse } from '@/types'

// Behavioural metrics move on the scale of weeks, not seconds.
const CACHE_TTL_MS = 60 * 60 * 1000
const CACHE_KEY = 'analysis:investor'

export const useAnalysisStore = defineStore('analysis', () => {
  const data = ref<InvestorAnalyticsResponse | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

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

  function reset(): void {
    data.value = null
    error.value = null
    invalidateCacheKey(CACHE_KEY)
  }

  return { data, isLoading, error, fetchAnalytics, reset }
})
