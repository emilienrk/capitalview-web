import { defineStore } from 'pinia'
import { ref } from 'vue'
import { apiClient } from '@/api/client'
import type {
  CashflowComparison,
  CashflowResponse,
  CashflowBalanceResponse,
  CashflowSummaryResponse,
  CashflowCreate,
  CashflowUpdate,
} from '@/types'

export const useCashflowStore = defineStore('cashflow', () => {
  const cashflows = ref<CashflowResponse[]>([])
  const balance = ref<CashflowBalanceResponse | null>(null)
  const inflows = ref<CashflowSummaryResponse | null>(null)
  const outflows = ref<CashflowSummaryResponse | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  /** Each active declaration against what actually moved for it. */
  const comparison = ref<CashflowComparison[]>([])
  const comparisonLoading = ref(false)

  async function fetchAll(): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      cashflows.value = await apiClient.get<CashflowResponse[]>('/cashflow')
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Erreur lors du chargement des flux'
    } finally {
      isLoading.value = false
    }
  }

  async function fetchBalance(): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      balance.value = await apiClient.get<CashflowBalanceResponse>('/cashflow/me/balance')
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Erreur lors du chargement du bilan'
    } finally {
      isLoading.value = false
    }
  }

  async function fetchInflows(): Promise<void> {
    try {
      inflows.value = await apiClient.get<CashflowSummaryResponse>('/cashflow/me/inflows')
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Erreur lors du chargement des revenus'
    }
  }

  async function fetchOutflows(): Promise<void> {
    try {
      outflows.value = await apiClient.get<CashflowSummaryResponse>('/cashflow/me/outflows')
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Erreur lors du chargement des dépenses'
    }
  }

  async function fetchComparison(months = 6): Promise<void> {
    comparisonLoading.value = true
    try {
      comparison.value = await apiClient.get<CashflowComparison[]>(
        `/cashflow/me/comparison?months=${months}`,
      )
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Erreur lors du rapprochement'
    } finally {
      comparisonLoading.value = false
    }
  }

  /**
   * Confirm — or clear — the label a declaration is matched against.
   *
   * The API answers with that declaration's fresh verdict, which is exactly
   * what the user wants to see the moment they confirm, so the row is replaced
   * in place rather than the whole list refetched.
   */
  async function updateMatch(id: string, pattern: string | null): Promise<boolean> {
    try {
      const updated = await apiClient.put<CashflowComparison>(`/cashflow/${id}/match`, {
        match_pattern: pattern,
      })
      const index = comparison.value.findIndex((row) => row.cashflow_id === id)
      if (index >= 0) comparison.value[index] = updated
      return true
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Erreur lors du rapprochement'
      return false
    }
  }

  async function createCashflow(data: CashflowCreate): Promise<CashflowResponse | null> {
    isLoading.value = true
    error.value = null
    try {
      const cashflow = await apiClient.post<CashflowResponse>('/cashflow', data)
      await fetchAll()
      return cashflow
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Erreur lors de la création'
      return null
    } finally {
      isLoading.value = false
    }
  }

  async function updateCashflow(id: string, data: CashflowUpdate): Promise<CashflowResponse | null> {
    isLoading.value = true
    error.value = null
    try {
      const cashflow = await apiClient.put<CashflowResponse>(`/cashflow/${id}`, data)
      await fetchAll()
      return cashflow
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Erreur lors de la mise à jour'
      return null
    } finally {
      isLoading.value = false
    }
  }

  async function deleteCashflow(id: string): Promise<boolean> {
    isLoading.value = true
    error.value = null
    try {
      await apiClient.delete(`/cashflow/${id}`)
      await fetchAll()
      return true
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Erreur lors de la suppression'
      return false
    } finally {
      isLoading.value = false
    }
  }

  function reset(): void {
    cashflows.value = []
    balance.value = null
    inflows.value = null
    outflows.value = null
    comparison.value = []
    error.value = null
  }

  return {
    cashflows,
    balance,
    inflows,
    outflows,
    comparison,
    comparisonLoading,
    isLoading,
    error,
    fetchAll,
    fetchBalance,
    fetchInflows,
    fetchOutflows,
    fetchComparison,
    updateMatch,
    createCashflow,
    updateCashflow,
    deleteCashflow,
    reset,
  }
})
