import { defineStore } from 'pinia'
import { ref } from 'vue'
import { apiClient } from '@/api/client'
import type {
  ImportSourcesResponse,
  ImportSourceInfo,
  DetectResponse,
  DetectMatch,
  ImportPreviewResponse,
  ImportConfirmRequest,
  ImportConfirmResponse,
  ImportOptions,
  ImportCategory,
} from '@/types'

export const useImportsStore = defineStore('imports', () => {
  const sources = ref<ImportSourceInfo[]>([])

  /** Fetch (and cache) the list of available import sources. */
  async function fetchSources(): Promise<ImportSourceInfo[]> {
    if (sources.value.length) return sources.value
    const res = await apiClient.get<ImportSourcesResponse>('/imports/sources')
    sources.value = res.sources
    return sources.value
  }

  /** Sources filtered to a given category. */
  async function sourcesFor(category: ImportCategory): Promise<ImportSourceInfo[]> {
    const all = await fetchSources()
    return all.filter((s) => s.category === category)
  }

  /** Score the CSV headers against every parser (best matches first). */
  async function detect(csvContent: string): Promise<DetectMatch[]> {
    const res = await apiClient.post<DetectResponse>('/imports/detect', { csv_content: csvContent })
    return res.matches
  }

  async function preview(
    sourceId: string,
    csvContent: string,
    accountId?: string,
    options: ImportOptions = {},
  ): Promise<ImportPreviewResponse> {
    return apiClient.post<ImportPreviewResponse>(`/imports/${sourceId}/preview`, {
      csv_content: csvContent,
      account_id: accountId,
      options,
    })
  }

  async function confirm(sourceId: string, payload: ImportConfirmRequest): Promise<ImportConfirmResponse> {
    return apiClient.post<ImportConfirmResponse>(`/imports/${sourceId}/confirm`, payload)
  }

  function reset(): void {
    sources.value = []
  }

  return { sources, fetchSources, sourcesFor, detect, preview, confirm, reset }
})
