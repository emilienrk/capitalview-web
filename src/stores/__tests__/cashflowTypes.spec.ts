import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { apiClient } from '@/api/client'
import { useBankStore } from '@/stores/bank'
import { useCashflowTypesStore } from '@/stores/cashflowTypes'
import { getOrFetchCached } from '@/services/cache'

vi.mock('@/api/client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

describe('useCashflowTypesStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.mocked(apiClient.get).mockResolvedValue({ total: 0, months: [] })
  })

  it('answers a flow question for this operation alone by default', async () => {
    vi.mocked(apiClient.put).mockResolvedValue({ transaction: {}, covered_count: 1 })

    await useCashflowTypesStore().answerFlow('tx 1', 'SAVING')

    expect(apiClient.put).toHaveBeenCalledWith('/banking/transactions/tx%201/type', { type: 'SAVING', scope: 'operation' })
  })

  it('types the whole label when asked to', async () => {
    vi.mocked(apiClient.put).mockResolvedValue({ transaction: {}, covered_count: 23 })

    const result = await useCashflowTypesStore().answerFlow('tx 1', 'SAVING', 'label')

    expect(apiClient.put).toHaveBeenCalledWith('/banking/transactions/tx%201/type', { type: 'SAVING', scope: 'label' })
    expect(result.covered_count).toBe(23)
  })

  it('types the operations ticked beside it, and never with a rule', async () => {
    vi.mocked(apiClient.put).mockResolvedValue({ transaction: {}, covered_count: 3 })
    const types = useCashflowTypesStore()

    await types.answerFlow('tx-1', 'SAVING', 'operation', ['tx-2', 'tx-3'])
    await types.answerFlow('tx-1', 'SAVING', 'label', ['tx-2'])

    expect(apiClient.put).toHaveBeenNthCalledWith(1, '/banking/transactions/tx-1/type', {
      type: 'SAVING', scope: 'operation', also: ['tx-2', 'tx-3'],
    })
    expect(apiClient.put).toHaveBeenNthCalledWith(2, '/banking/transactions/tx-1/type', { type: 'SAVING', scope: 'label' })
  })

  it('takes back several answers in one refresh', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({})
    const bank = useBankStore()

    await useCashflowTypesStore().clearOverride('tx-1', 'tx-2')

    expect(apiClient.delete).toHaveBeenCalledWith('/banking/transactions/tx-1/type')
    expect(apiClient.delete).toHaveBeenCalledWith('/banking/transactions/tx-2/type')
    expect(bank.dataRevision).toBe(1)
  })

  it('makes every observed flow stale after a write', async () => {
    vi.mocked(apiClient.put).mockResolvedValue({ transaction: {}, covered_count: 1 })
    const bank = useBankStore()
    const fetcher = vi.fn().mockResolvedValue('fresh')
    await getOrFetchCached('bank:flows:transactions:2026-03', () => Promise.resolve('stale'), 60_000)

    await useCashflowTypesStore().setType('tx-1', 'NEUTRAL', 'operation')

    expect(apiClient.put).toHaveBeenCalledWith('/banking/transactions/tx-1/type', { type: 'NEUTRAL', scope: 'operation' })
    expect(bank.dataRevision).toBe(1)
    expect(await getOrFetchCached('bank:flows:transactions:2026-03', fetcher, 60_000)).toBe('fresh')
    expect(apiClient.get).toHaveBeenCalledWith('/banking/transfer-questions')
  })

  it('drops a deleted rule from the list', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce([{ id: 'r1' }, { id: 'r2' }])
    const store = useCashflowTypesStore()
    await store.fetchRules()

    await store.deleteRule('r1')

    expect(apiClient.delete).toHaveBeenCalledWith('/banking/type-rules/r1')
    expect(store.rules?.map((rule) => rule.id)).toEqual(['r2'])
  })

  it('swaps a retyped rule for the one that comes back', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce([{ id: 'r1', type: 'EXPENSE' }, { id: 'r2', type: 'SAVING' }])
    vi.mocked(apiClient.patch).mockResolvedValueOnce({ id: 'r3', type: 'INVESTMENT' })
    const store = useCashflowTypesStore()
    await store.fetchRules()

    await store.retypeRule('r1', 'INVESTMENT')

    expect(apiClient.patch).toHaveBeenCalledWith('/banking/type-rules/r1', { type: 'INVESTMENT' })
    expect(store.rules?.map((rule) => rule.id)).toEqual(['r3', 'r2'])
  })

  it('reads the review queue, for every year or one', async () => {
    const store = useCashflowTypesStore()
    vi.mocked(apiClient.get).mockResolvedValueOnce({ total_amount: 10, total_count: 1, years: [], questions: [] })
    await store.fetchReviewQueue()
    expect(apiClient.get).toHaveBeenCalledWith('/banking/review-queue')
    expect(store.queue?.total_amount).toBe(10)

    vi.mocked(apiClient.get).mockResolvedValueOnce({ total_amount: 4, total_count: 1, years: [], questions: [] })
    await store.fetchReviewQueue(2025)
    expect(apiClient.get).toHaveBeenCalledWith('/banking/review-queue?year=2025')
    expect(store.queueYear).toBe(2025)
    expect(store.queue?.total_amount).toBe(4)
  })

  it('keeps the queue of the year asked last', async () => {
    let answerAll!: (value: unknown) => void
    vi.mocked(apiClient.get)
      .mockImplementationOnce(() => new Promise((resolve) => { answerAll = resolve }))
      .mockResolvedValueOnce({ total_amount: 4, total_count: 1, years: [], questions: [] })
    const store = useCashflowTypesStore()

    const all = store.fetchReviewQueue()
    await store.fetchReviewQueue(2025)
    answerAll({ total_amount: 99, total_count: 9, years: [], questions: [] })
    await all

    expect(store.queue?.total_amount).toBe(4)
  })
})

describe('an answer shown before the API holds it', () => {
  const tx = {
    id: 'tx-1', account_id: 'acc-1', account_name: 'Compte courant', operation_date: '2026-03-05', amount: 40,
    currency: 'EUR', is_credit: true, is_pending: false, label: 'VIR SERGE', transfer_account_id: null,
    transfer_account_name: null, transfer_id: null, transfer_status: null, cashflow_type: 'INCOME', type_source: 'default',
    type_rule_id: null, flow_question: { choices: ['INCOME'], operation_count: 1, amount: 40 }, contribution: null,
    asks_contribution: false, recurring: null, recurring_question: null,
  } as const
  const queue = {
    total_amount: 40, total_count: 1, recurring_count: 0, unfaced: [],
    years: [{ year: 2026, amount: 40, count: 1 }],
    questions: [{ kind: 'flow', group: 'g', transaction: tx, amount: 40, operation_count: 1 }],
  }
  const counts = { total: 1, recurring: 0, months: [{ period: '2026-03', count: 1 }] }
  const answer = () => ({ operations: {}, settled: [{ ids: ['tx-1'], day: '2026-03-05' }], shrunk: {} })

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  async function opened() {
    vi.mocked(apiClient.get).mockResolvedValueOnce(structuredClone(queue)).mockResolvedValueOnce({ ...counts })
    const types = useCashflowTypesStore()
    const bank = useBankStore()
    await types.fetchReviewQueue()
    await bank.fetchTransferQuestions()
    return { types, bank }
  }

  it('moves the queue and the tab at the click, and puts them back when the API fails', async () => {
    const { types, bank } = await opened()
    let fail!: (error: Error) => void
    const pending = bank.answering(answer(), () => new Promise((_, reject) => { fail = reject }))

    expect(types.queue?.questions).toEqual([])
    expect(types.queue?.total_amount).toBe(0)
    expect(bank.transferQuestions?.total).toBe(0)

    fail(new Error('Erreur serveur'))
    await expect(pending).rejects.toThrow('Erreur serveur')
    expect(types.queue?.questions.map((q) => q.group)).toEqual(['g'])
    expect(types.queue?.total_amount).toBe(40)
    expect(bank.transferQuestions?.total).toBe(1)
  })

  it('holds the answer over a reading asked before it was stored, and hands over to the next one', async () => {
    const { types, bank } = await opened()
    await bank.answering(answer(), async () => { bank.operationsRead() })
    expect(types.queue?.questions).toEqual([])

    // A reading asked before the answer was stored, landing late, still shows it answered.
    const before = bank.dataRevision - 1
    expect(bank.answersSince(before)).toHaveLength(1)

    // The reload asked since holds it: what the server says is shown as is.
    vi.mocked(apiClient.get).mockResolvedValueOnce({ ...structuredClone(queue), total_amount: 7 })
    await types.fetchReviewQueue()
    expect(bank.answersSince(bank.dataRevision)).toEqual([])
    expect(types.queue?.total_amount).toBe(7)
    expect(types.queue?.questions).toHaveLength(1)
  })
})
