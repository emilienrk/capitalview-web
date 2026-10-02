import { defineStore } from 'pinia'
import { ref } from 'vue'
import { apiClient } from '@/api/client'
import { invalidateWealthViews } from '@/services/cache'
import type {
  AssetResponse,
  AssetSummaryResponse,
  AssetCreate,
  AssetUpdate,
  AssetSell,
  AssetValuationCreate,
  AssetValuationUpdate,
  AssetValuationResponse,
} from '@/types'

export const useAssetStore = defineStore('asset', () => {
  const summary = ref<AssetSummaryResponse | null>(null)
  const currentAsset = ref<AssetResponse | null>(null)
  const valuations = ref<AssetValuationResponse[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  /** Bumped by every write the API answers with a rebuilt history; the pages drawing it reload. */
  const dataRevision = ref(0)

  function markHistoryChanged(): void {
    invalidateWealthViews()
    dataRevision.value += 1
  }

  async function fetchAssets(): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      summary.value = await apiClient.get<AssetSummaryResponse>('/assets')
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Erreur lors du chargement des biens'
    } finally {
      isLoading.value = false
    }
  }

  async function fetchAsset(id: string): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      currentAsset.value = await apiClient.get<AssetResponse>(`/assets/${id}`)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Erreur lors du chargement du bien'
    } finally {
      isLoading.value = false
    }
  }

  async function createAsset(data: AssetCreate): Promise<AssetResponse | null> {
    isLoading.value = true
    error.value = null
    try {
      const asset = await apiClient.post<AssetResponse>('/assets', data)
      markHistoryChanged()
      await fetchAssets()
      return asset
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Erreur lors de la création du bien'
      return null
    } finally {
      isLoading.value = false
    }
  }

  async function updateAsset(id: string, data: AssetUpdate): Promise<AssetResponse | null> {
    isLoading.value = true
    error.value = null
    try {
      const asset = await apiClient.put<AssetResponse>(`/assets/${id}`, data)
      markHistoryChanged()
      await fetchAssets()
      return asset
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Erreur lors de la mise à jour du bien'
      return null
    } finally {
      isLoading.value = false
    }
  }

  async function deleteAsset(id: string): Promise<boolean> {
    isLoading.value = true
    error.value = null
    try {
      await apiClient.delete(`/assets/${id}`)
      markHistoryChanged()
      await fetchAssets()
      return true
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Erreur lors de la suppression'
      return false
    } finally {
      isLoading.value = false
    }
  }

  async function sellAsset(id: string, data: AssetSell): Promise<AssetResponse | null> {
    isLoading.value = true
    error.value = null
    try {
      const asset = await apiClient.post<AssetResponse>(`/assets/${id}/sell`, data)
      markHistoryChanged()
      await fetchAssets()
      return asset
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Erreur lors de la vente'
      return null
    } finally {
      isLoading.value = false
    }
  }


  async function fetchValuations(assetId: string): Promise<void> {
    try {
      valuations.value = await apiClient.get<AssetValuationResponse[]>(`/assets/${assetId}/valuations`)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Erreur lors du chargement de l\'historique'
    }
  }

  async function addValuation(assetId: string, data: AssetValuationCreate): Promise<AssetValuationResponse | null> {
    try {
      const v = await apiClient.post<AssetValuationResponse>(`/assets/${assetId}/valuations`, data)
      markHistoryChanged()
      await Promise.all([fetchValuations(assetId), fetchAssets()])
      return v
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Erreur lors de l\'ajout de la valorisation'
      return null
    }
  }

  async function updateValuation(
    assetId: string,
    valuationId: string,
    data: AssetValuationUpdate,
  ): Promise<AssetValuationResponse | null> {
    try {
      const v = await apiClient.put<AssetValuationResponse>(`/assets/${assetId}/valuations/${valuationId}`, data)
      markHistoryChanged()
      await Promise.all([fetchValuations(assetId), fetchAssets()])
      return v
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Erreur lors de la mise a jour de la valorisation'
      return null
    }
  }

  async function deleteValuation(assetId: string, valuationId: string): Promise<boolean> {
    try {
      await apiClient.delete(`/assets/${assetId}/valuations/${valuationId}`)
      markHistoryChanged()
      await Promise.all([fetchValuations(assetId), fetchAssets()])
      return true
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Erreur lors de la suppression'
      return false
    }
  }

  function reset(): void {
    summary.value = null
    currentAsset.value = null
    valuations.value = []
    error.value = null
  }

  return {
    summary,
    currentAsset,
    valuations,
    isLoading,
    error,
    dataRevision,
    fetchAssets,
    fetchAsset,
    createAsset,
    updateAsset,
    deleteAsset,
    sellAsset,
    fetchValuations,
    addValuation,
    updateValuation,
    deleteValuation,
    reset,
  }
})
