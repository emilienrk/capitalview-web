import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useCashflowStore } from '@/stores/cashflow'
import type { CashflowComparison } from '@/types'

vi.mock('@/api/client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

function aComparison(overrides: Partial<CashflowComparison> = {}): CashflowComparison {
  return {
    cashflow_id: 'cf-1',
    name: 'Loyer',
    flow_type: 'OUTFLOW',
    frequency: 'MONTHLY',
    category: 'Logement',
    declared_amount: 850,
    currency: 'EUR',
    status: 'unmatched',
    match_pattern: null,
    observed_amount: null,
    last_seen: null,
    occurrences: 0,
    recent: [],
    candidates: [],
    ...overrides,
  }
}

describe('useCashflowStore — the declared/observed comparison', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('asks for the requested window', async () => {
    const { apiClient } = await import('@/api/client')
    vi.mocked(apiClient.get).mockResolvedValue([aComparison()])

    await useCashflowStore().fetchComparison(12)

    expect(apiClient.get).toHaveBeenCalledWith('/cashflow/me/comparison?months=12')
  })

  it('replaces the confirmed row with the verdict the API answers', async () => {
    const { apiClient } = await import('@/api/client')
    vi.mocked(apiClient.get).mockResolvedValue([aComparison(), aComparison({ cashflow_id: 'cf-2' })])
    vi.mocked(apiClient.put).mockResolvedValue(
      aComparison({ status: 'on_track', match_pattern: 'PRLV SEPA FONCIA', observed_amount: 850 }),
    )

    const store = useCashflowStore()
    await store.fetchComparison()
    expect(await store.updateMatch('cf-1', 'PRLV SEPA FONCIA')).toBe(true)

    expect(apiClient.put).toHaveBeenCalledWith('/cashflow/cf-1/match', {
      match_pattern: 'PRLV SEPA FONCIA',
    })
    expect(store.comparison[0].status).toBe('on_track')
    // Confirming one row must not disturb the others, nor refetch the list.
    expect(store.comparison[1].cashflow_id).toBe('cf-2')
    expect(vi.mocked(apiClient.get)).toHaveBeenCalledTimes(1)
  })

  it('clears the link with a null pattern rather than a blank one', async () => {
    const { apiClient } = await import('@/api/client')
    vi.mocked(apiClient.put).mockResolvedValue(aComparison())

    await useCashflowStore().updateMatch('cf-1', null)

    expect(apiClient.put).toHaveBeenCalledWith('/cashflow/cf-1/match', { match_pattern: null })
  })

  it('reports a failed confirmation instead of pretending it worked', async () => {
    const { apiClient } = await import('@/api/client')
    vi.mocked(apiClient.put).mockRejectedValue(new Error('Flux introuvable.'))

    const store = useCashflowStore()
    expect(await store.updateMatch('cf-1', 'X')).toBe(false)
    expect(store.error).toBe('Flux introuvable.')
  })
})
