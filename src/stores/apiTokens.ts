import { defineStore } from 'pinia'
import { ref } from 'vue'
import { apiClient } from '@/api/client'
import type {
  ApiToken,
  ApiTokenCreateRequest,
  ApiTokenCreated,
  McpConnection,
} from '@/types'

/**
 * API tokens: the credentials that let an agent client (Claude Desktop, Claude
 * Code…) reach the account over MCP.
 *
 * The secret is deliberately never held here. It exists once, in the response to
 * the mint call, and the caller shows it immediately — putting it in the store
 * would only make it outlive the moment the user can act on it.
 */
export const useApiTokensStore = defineStore('apiTokens', () => {
  const tokens = ref<ApiToken[]>([])
  const connection = ref<McpConnection | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function fetchTokens(): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      tokens.value = await apiClient.get<ApiToken[]>('/auth/tokens')
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Erreur lors du chargement des tokens.'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function fetchConnection(): Promise<void> {
    // The URL is deployment-specific, so it comes from the API rather than being
    // guessed from window.location.
    connection.value = await apiClient.get<McpConnection>('/auth/tokens/mcp')
  }

  async function createToken(payload: ApiTokenCreateRequest): Promise<ApiTokenCreated> {
    const created = await apiClient.post<ApiTokenCreated>('/auth/tokens', payload)
    await fetchTokens()
    return created
  }

  async function revokeToken(uuid: string): Promise<void> {
    await apiClient.delete(`/auth/tokens/${uuid}`)
    tokens.value = tokens.value.filter((token) => token.uuid !== uuid)
  }

  function reset(): void {
    tokens.value = []
    connection.value = null
    isLoading.value = false
    error.value = null
  }

  return {
    tokens,
    connection,
    isLoading,
    error,
    fetchTokens,
    fetchConnection,
    createToken,
    revokeToken,
    reset,
  }
})
