import { defineStore } from 'pinia'
import { ref } from 'vue'

import { apiClient } from '@/api/client'
import { getOrFetchCached } from '@/services/cache'
import type { RealCashflowMonthDetail, RealCashflowYear } from '@/types'

// Under the observed flows' prefix: a sync, an import or a filing makes them
// stale at the same moments.
const CACHE_PREFIX = 'bank:flows:real:'
const CACHE_TTL_MS = 60 * 60 * 1000

export const useRealCashflowStore = defineStore('realCashflow', () => {
  const year = ref<RealCashflowYear | null>(null)
  const month = ref<RealCashflowMonthDetail | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  // The last request made, so a slower earlier answer never replaces a newer one.
  let latest = ''

  async function load<T>(key: string, endpoint: string, apply: (value: T) => void, force: boolean): Promise<void> {
    latest = key
    loading.value = true
    error.value = null
    try {
      const value = await getOrFetchCached<T>(`${CACHE_PREFIX}${key}`, () => apiClient.get<T>(endpoint), CACHE_TTL_MS, force)
      if (latest === key) apply(value)
    } catch (e) {
      if (latest === key) error.value = e instanceof Error ? e.message : 'Impossible de charger le cashflow réel.'
    } finally {
      if (latest === key) loading.value = false
    }
  }

  function fetchYear(value: number, force = false): Promise<void> {
    return load<RealCashflowYear>(`year:${value}`, `/banking/real-cashflow?year=${value}`, (data) => {
      year.value = data
    }, force)
  }

  function fetchMonth(period: string, force = false): Promise<void> {
    return load<RealCashflowMonthDetail>(`month:${period}`, `/banking/real-cashflow/months/${period}`, (data) => {
      month.value = data
    }, force)
  }

  function reset(): void {
    year.value = null
    month.value = null
    error.value = null
    latest = ''
  }

  return { year, month, loading, error, fetchYear, fetchMonth, reset }
})
