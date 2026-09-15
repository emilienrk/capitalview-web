import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { apiClient } from '@/api/client'
import { getCachedValue, getOrFetchCached } from '@/services/cache'
import { useBankStore } from '@/stores/bank'
import { useBankCategoriesStore } from '@/stores/bankCategories'
import type { BankAICategorizeResult } from '@/types'

vi.mock('@/api/client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

const post = vi.mocked(apiClient.post)
const get = vi.mocked(apiClient.get)

function batch(overrides: Partial<BankAICategorizeResult>): BankAICategorizeResult {
  return { processed: 100, rules_created: 60, categories_created: 3, skip: 0, remaining: 0, ...overrides }
}

function aiCalls(): string[] {
  return post.mock.calls.map(([endpoint]) => endpoint as string).filter((e) => e.startsWith('/banking/categorize/ai'))
}

describe('useBankCategoriesStore — AI categorisation', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    get.mockResolvedValue([])
  })

  it('asks batch after batch, passing back the skip, until nothing remains', async () => {
    post
      .mockResolvedValueOnce(batch({ skip: 40, remaining: 150 }))
      .mockResolvedValueOnce(batch({ skip: 75, remaining: 60 }))
      .mockResolvedValueOnce(batch({ processed: 60, rules_created: 20, skip: 115, remaining: 0 }))
    const store = useBankCategoriesStore()

    await store.runAiCategorization()

    expect(aiCalls()).toEqual([
      '/banking/categorize/ai?skip=0',
      '/banking/categorize/ai?skip=40',
      '/banking/categorize/ai?skip=75',
    ])
    expect(store.aiProgress).toMatchObject({
      running: false, batches: 3, processed: 260, rulesCreated: 140, categoriesCreated: 9, remaining: 0, error: null,
    })
  })

  it('stops on the first failed batch and says why', async () => {
    post
      .mockResolvedValueOnce(batch({ skip: 10, remaining: 90 }))
      .mockRejectedValueOnce(new Error('Configurez d\'abord un fournisseur d\'IA.'))
    const store = useBankCategoriesStore()

    await store.runAiCategorization()

    expect(aiCalls()).toHaveLength(2)
    expect(store.aiProgress).toMatchObject({
      running: false, batches: 1, remaining: 90, error: 'Configurez d\'abord un fournisseur d\'IA.',
    })
  })

  it('stops when a batch tried nothing, rather than asking forever', async () => {
    post.mockResolvedValue(batch({ processed: 0, skip: 5, remaining: 5 }))
    const store = useBankCategoriesStore()

    await store.runAiCategorization()

    expect(aiCalls()).toHaveLength(1)
  })

  it('makes the observed flows stale once the run is over', async () => {
    post.mockResolvedValueOnce(batch({ remaining: 0 }))
    await getOrFetchCached('bank:flows:12:all', async () => ({ months: [] }), 60_000)
    const bank = useBankStore()
    const revision = bank.dataRevision

    await useBankCategoriesStore().runAiCategorization()

    expect(getCachedValue('bank:flows:12:all')).toBeNull()
    expect(bank.dataRevision).toBe(revision + 1)
  })
})

describe('useBankCategoriesStore — filing', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    get.mockResolvedValue([])
  })

  it('makes the observed flows stale after filing an operation', async () => {
    vi.mocked(apiClient.put).mockResolvedValueOnce({ filed_count: 42, transaction: {} })
    await getOrFetchCached('bank:flows:transactions:2026-03:all', async () => ({}), 60_000)
    const bank = useBankStore()
    const revision = bank.dataRevision

    const result = await useBankCategoriesStore().assignCategory('tx-1', { category_id: 'c-1', apply_to_similar: true, tokens: ['carrefour'] })

    expect(result.filed_count).toBe(42)
    expect(apiClient.put).toHaveBeenCalledWith('/banking/transactions/tx-1/category', {
      category_id: 'c-1', apply_to_similar: true, tokens: ['carrefour'],
    })
    expect(getCachedValue('bank:flows:transactions:2026-03:all')).toBeNull()
    expect(bank.dataRevision).toBe(revision + 1)
  })
})
