import { defineStore } from 'pinia'
import { ref } from 'vue'
import { apiClient } from '@/api/client'
import type {
  PortfolioResponse,
  BankSummaryResponse,
  CashflowBalanceResponse,
  DashboardStatisticsResponse,
  ProjectionParameters,
  ProjectionResponse,
  UserSettingsResponse,
} from '@/types'

export const useDashboardStore = defineStore('dashboard', () => {
  const portfolio = ref<PortfolioResponse | null>(null)
  const bankAccounts = ref<BankSummaryResponse | null>(null)
  const cashflowBalance = ref<CashflowBalanceResponse | null>(null)
  const statistics = ref<DashboardStatisticsResponse | null>(null)
  const projection = ref<ProjectionResponse | null>(null)
  const projectionLoading = ref(false)
  const projectionError = ref<string | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const _liveFetchSeq = ref(0)

  async function fetchAll(settings?: UserSettingsResponse | null) {
    isLoading.value = true
    error.value = null

    const bankEnabled = settings?.bank_module_enabled ?? true
    const cashflowEnabled = settings?.cashflow_module_enabled ?? true

    try {
      // First load: portfolio from DB (fast) + other endpoints in parallel
      const fastRequests: Promise<unknown>[] = [
        apiClient.get<PortfolioResponse>('/dashboard/portfolio?db_only=true'),
        bankEnabled
          ? apiClient.get<BankSummaryResponse>('/bank/accounts')
          : Promise.resolve(null),
        cashflowEnabled
          ? apiClient.get<CashflowBalanceResponse>('/cashflow/me/balance')
          : Promise.resolve(null),
        apiClient.get<DashboardStatisticsResponse>('/dashboard/statistics?db_only=true'),
      ]

      const [portfolioData, bankData, cashflowData, statsData] = await Promise.all(fastRequests)

      portfolio.value = portfolioData as PortfolioResponse
      bankAccounts.value = bankEnabled ? (bankData as BankSummaryResponse) : null
      cashflowBalance.value = cashflowEnabled ? (cashflowData as CashflowBalanceResponse) : null
      statistics.value = statsData as DashboardStatisticsResponse
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load dashboard'
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
    cashflowBalance.value = null
    statistics.value = null
    projection.value = null
    projectionLoading.value = false
    projectionError.value = null
    error.value = null
  }

  return {
    portfolio,
    bankAccounts,
    cashflowBalance,
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
