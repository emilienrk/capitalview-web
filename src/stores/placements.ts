import { defineStore } from 'pinia'
import { ref } from 'vue'
import { apiClient } from '@/api/client'
import type {
  AccountHistorySnapshotResponse,
  PlacementAccountCreate,
  PlacementAccountResponse,
  PlacementAccountUpdate,
  PlacementEntryCreate,
  PlacementEntryResponse,
  PlacementEntryUpdate,
  PlacementSummaryResponse,
} from '@/types'

export const usePlacementsStore = defineStore('placements', () => {
  const summary = ref<PlacementSummaryResponse | null>(null)
  const entriesByAccount = ref<Record<string, PlacementEntryResponse[]>>({})
  const history = ref<AccountHistorySnapshotResponse[]>([])
  const isLoading = ref(false)
  const historyLoading = ref(false)
  const error = ref<string | null>(null)

  function fail(e: unknown, fallback: string): void {
    error.value = e instanceof Error ? e.message : fallback
  }

  async function fetchPlacements(): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      summary.value = await apiClient.get<PlacementSummaryResponse>('/placements')
    } catch (e) {
      fail(e, 'Erreur lors du chargement des placements')
    } finally {
      isLoading.value = false
    }
  }

  async function fetchHistory(): Promise<void> {
    historyLoading.value = true
    try {
      history.value = await apiClient.get<AccountHistorySnapshotResponse[]>('/placements/history')
    } catch (e) {
      fail(e, "Erreur lors du chargement de l'historique")
    } finally {
      historyLoading.value = false
    }
  }

  async function createPlacement(data: PlacementAccountCreate): Promise<PlacementAccountResponse | null> {
    error.value = null
    try {
      const placement = await apiClient.post<PlacementAccountResponse>('/placements', data)
      await fetchPlacements()
      return placement
    } catch (e) {
      fail(e, 'Erreur lors de la création du placement')
      return null
    }
  }

  async function updatePlacement(
    id: string,
    data: PlacementAccountUpdate,
  ): Promise<PlacementAccountResponse | null> {
    error.value = null
    try {
      const placement = await apiClient.put<PlacementAccountResponse>(`/placements/${id}`, data)
      await fetchPlacements()
      return placement
    } catch (e) {
      fail(e, 'Erreur lors de la mise à jour du placement')
      return null
    }
  }

  async function deletePlacement(id: string): Promise<boolean> {
    error.value = null
    try {
      await apiClient.delete(`/placements/${id}`)
      delete entriesByAccount.value[id]
      await Promise.all([fetchPlacements(), fetchHistory()])
      return true
    } catch (e) {
      fail(e, 'Erreur lors de la suppression du placement')
      return false
    }
  }

  async function fetchEntries(accountId: string): Promise<void> {
    try {
      entriesByAccount.value[accountId] = await apiClient.get<PlacementEntryResponse[]>(
        `/placements/${accountId}/entries`,
      )
    } catch (e) {
      fail(e, 'Erreur lors du chargement des opérations')
    }
  }

  async function refreshAfterEntryChange(accountId: string): Promise<void> {
    await Promise.all([fetchEntries(accountId), fetchPlacements(), fetchHistory()])
  }

  async function addEntry(accountId: string, data: PlacementEntryCreate): Promise<boolean> {
    error.value = null
    try {
      await apiClient.post<PlacementEntryResponse>(`/placements/${accountId}/entries`, data)
      await refreshAfterEntryChange(accountId)
      return true
    } catch (e) {
      fail(e, "Erreur lors de l'ajout de l'opération")
      return false
    }
  }

  async function updateEntry(accountId: string, entryId: string, data: PlacementEntryUpdate): Promise<boolean> {
    error.value = null
    try {
      await apiClient.put<PlacementEntryResponse>(`/placements/${accountId}/entries/${entryId}`, data)
      await refreshAfterEntryChange(accountId)
      return true
    } catch (e) {
      fail(e, "Erreur lors de la modification de l'opération")
      return false
    }
  }

  async function deleteEntry(accountId: string, entryId: string): Promise<boolean> {
    error.value = null
    try {
      await apiClient.delete(`/placements/${accountId}/entries/${entryId}`)
      await refreshAfterEntryChange(accountId)
      return true
    } catch (e) {
      fail(e, "Erreur lors de la suppression de l'opération")
      return false
    }
  }

  function reset(): void {
    summary.value = null
    entriesByAccount.value = {}
    history.value = []
    isLoading.value = false
    historyLoading.value = false
    error.value = null
  }

  return {
    summary,
    entriesByAccount,
    history,
    isLoading,
    historyLoading,
    error,
    fetchPlacements,
    fetchHistory,
    createPlacement,
    updatePlacement,
    deletePlacement,
    fetchEntries,
    addEntry,
    updateEntry,
    deleteEntry,
    reset,
  }
})
