import { defineStore } from 'pinia'
import { ref } from 'vue'
import { apiClient } from '@/api/client'
import type {
  PortfolioResponse,
  BankSummaryResponse,
  DashboardStatisticsResponse,
  ProjectionParameters,
  ProjectionResponse,
  UserSettingsResponse,
} from '@/types'

export const useDashboardStore = defineStore('dashboard', () => {
  const portfolio = ref<PortfolioResponse | null>(null)
  const bankAccounts = ref<BankSummaryResponse | null>(null)
  const statistics = ref<DashboardStatisticsResponse | null>(null)
  const projection = ref<ProjectionResponse | null>(null)
  const projectionLoading = ref(false)
  const projectionError = ref<string | null>(null)
  const isLoading = ref(false)
  /** False while the figures still rest on the prices stored in the database. */
  const pricesLive = ref(false)
  const error = ref<string | null>(null)
  const _liveFetchSeq = ref(0)

  async function fetchAll(settings?: UserSettingsResponse | null) {
    isLoading.value = true
    error.value = null
    pricesLive.value = false

    const bankEnabled = settings?.bank_module_enabled ?? true

    try {
      // First load: portfolio from DB (fast) + other endpoints in parallel
      const fastRequests: Promise<unknown>[] = [
        apiClient.get<PortfolioResponse>('/dashboard/portfolio?db_only=true'),
        bankEnabled
          ? apiClient.get<BankSummaryResponse>('/bank/accounts')
          : Promise.resolve(null),
        apiClient.get<DashboardStatisticsResponse>('/dashboard/statistics?db_only=true'),
      ]

      const [portfolioData, bankData, statsData] = await Promise.all(fastRequests)

      portfolio.value = portfolioData as PortfolioResponse
      bankAccounts.value = bankEnabled ? (bankData as BankSummaryResponse) : null
      statistics.value = statsData as DashboardStatisticsResponse
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Impossible de charger le tableau de bord.'
    } finally {
      isLoading.value = false
    }

    // Then refresh portfolio + statistics in background with live market data
    const seq = ++_liveFetchSeq.value
    Promise.all([
      apiClient.get<PortfolioResponse>('/dashboard/portfolio'),
      apiClient.get<DashboardStatisticsResponse>('/dashboard/statistics'),
    ])
      .then(([portfolioData, statsData]) => {
        if (seq === _liveFetchSeq.value) {
          portfolio.value = portfolioData as PortfolioResponse
          statistics.value = statsData as DashboardStatisticsResponse
          pricesLive.value = true
        }
      })
      .catch(() => { /* keep cached data on error */ })
  }

  async function fetchProjection(
    params: ProjectionParameters = { months_to_project: 120 },
  ): Promise<void> {
    projectionLoading.value = true
    projectionError.value = null

    try {
      projection.value = await apiClient.post<ProjectionResponse>('/projections/calculate', params)
    } catch (e) {
      projectionError.value = e instanceof Error ? e.message : 'Impossible de charger la projection.'
      projection.value = null
    } finally {
      projectionLoading.value = false
    }
  }

  function reset() {
    portfolio.value = null
    bankAccounts.value = null
    pricesLive.value = false
    statistics.value = null
    projection.value = null
    projectionLoading.value = false
    projectionError.value = null
    error.value = null
  }

  return {
    portfolio,
    bankAccounts,
    pricesLive,
    statistics,
    projection,
    projectionLoading,
    projectionError,
    isLoading,
    error,
    fetchAll,
    fetchProjection,
    reset,
  }
})
