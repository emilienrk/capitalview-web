import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useApiTokensStore } from '@/stores/apiTokens'

vi.mock('@/api/client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}))

const A_TOKEN = {
  uuid: 'tok-1',
  name: 'Claude Desktop',
  scopes: ['read'],
  created_at: '2026-08-13T09:00:00Z',
  last_used_at: null,
  expires_at: null,
}

describe('useApiTokensStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('loads the account tokens', async () => {
    const { apiClient } = await import('@/api/client')
    vi.mocked(apiClient.get).mockResolvedValue([A_TOKEN])

    const store = useApiTokensStore()
    await store.fetchTokens()

    expect(apiClient.get).toHaveBeenCalledWith('/auth/tokens')
    expect(store.tokens).toHaveLength(1)
    expect(store.error).toBeNull()
  })

  it('surfaces a load failure instead of leaving a stale list', async () => {
    const { apiClient } = await import('@/api/client')
    vi.mocked(apiClient.get).mockRejectedValue(new Error('Session expired'))

    const store = useApiTokensStore()

    await expect(store.fetchTokens()).rejects.toThrow('Session expired')
    expect(store.error).toBe('Session expired')
    expect(store.isLoading).toBe(false)
  })

  it('returns the minted secret without ever keeping it in the store', async () => {
    const { apiClient } = await import('@/api/client')
    vi.mocked(apiClient.post).mockResolvedValue({ ...A_TOKEN, token: 'cvw_secret' })
    vi.mocked(apiClient.get).mockResolvedValue([A_TOKEN])

    const store = useApiTokensStore()
    const created = await store.createToken({ password: 'pw', name: 'Claude Desktop' })

    expect(created.token).toBe('cvw_secret')
    expect(JSON.stringify(store.tokens)).not.toContain('cvw_secret')
  })

  it('drops a revoked token from the list', async () => {
    const { apiClient } = await import('@/api/client')
    vi.mocked(apiClient.get).mockResolvedValue([A_TOKEN, { ...A_TOKEN, uuid: 'tok-2' }])
    vi.mocked(apiClient.delete).mockResolvedValue(undefined)

    const store = useApiTokensStore()
    await store.fetchTokens()
    await store.revokeToken('tok-1')

    expect(apiClient.delete).toHaveBeenCalledWith('/auth/tokens/tok-1')
    expect(store.tokens.map((t) => t.uuid)).toEqual(['tok-2'])
  })

  it('reads the MCP endpoint from the API rather than guessing it', async () => {
    const { apiClient } = await import('@/api/client')
    vi.mocked(apiClient.get).mockResolvedValue({
      url: 'https://api.example.com/mcp',
      transport: 'streamable-http',
      enabled: true,
    })

    const store = useApiTokensStore()
    await store.fetchConnection()

    expect(apiClient.get).toHaveBeenCalledWith('/auth/tokens/mcp')
    expect(store.connection?.url).toBe('https://api.example.com/mcp')
  })

  it('clears everything on session reset', async () => {
    const { apiClient } = await import('@/api/client')
    vi.mocked(apiClient.get).mockResolvedValue([A_TOKEN])

    const store = useApiTokensStore()
    await store.fetchTokens()
    store.reset()

    expect(store.tokens).toEqual([])
    expect(store.connection).toBeNull()
  })
})
