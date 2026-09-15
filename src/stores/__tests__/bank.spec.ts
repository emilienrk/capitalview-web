import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useBankStore } from '@/stores/bank'
import { clearCache } from '@/services/cache'
import { useDisplayTimezone } from '@/composables/useDisplayTimezone'
import type { BankAccountResponse, BankTransactionsResponse } from '@/types'

vi.mock('@/api/client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

function anAccount(overrides: Partial<BankAccountResponse> = {}): BankAccountResponse {
  return {
    id: 'acc-1',
    name: 'Compte courant',
    institution_name: null,
    balance: 100,
    account_type: 'CHECKING',
    identifier: null,
    opened_at: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    balance_updated_at: null,
    is_linked: true,
    last_synced_at: null,
    reconciliation_gap: null,
    reconciliation_status: null,
    link_status: null,
    ...overrides,
  }
}

/** Today as the store sees it, in the timezone currently configured. */
function todayIn(timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
}

describe('useBankStore — hasStaleSync', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useDisplayTimezone().setDisplayTimezone('Europe/Paris')
    vi.clearAllMocks()
  })

  it('ignores accounts that are not linked to a bank', () => {
    const store = useBankStore()
    store.summary = { total_balance: 0, accounts: [anAccount({ is_linked: false })] }

    expect(store.linkedAccounts).toHaveLength(0)
    expect(store.hasStaleSync).toBe(false)
  })

  it('is stale when a linked account was never synced', () => {
    const store = useBankStore()
    store.summary = { total_balance: 0, accounts: [anAccount({ last_synced_at: null })] }

    expect(store.hasStaleSync).toBe(true)
  })

  it('is not stale when every linked account was synced today, local time', () => {
    const store = useBankStore()
    store.summary = {
      total_balance: 0,
      accounts: [anAccount({ last_synced_at: todayIn('Europe/Paris') })],
    }

    expect(store.hasStaleSync).toBe(false)
  })

  it('is stale when a linked account was last synced yesterday', () => {
    const store = useBankStore()
    store.summary = { total_balance: 0, accounts: [anAccount({ last_synced_at: '2020-01-01' })] }

    expect(store.hasStaleSync).toBe(true)
  })

  it('is not stale when today\'s attempt failed: a failure spends the day too', () => {
    const store = useBankStore()
    store.summary = {
      total_balance: 0,
      accounts: [anAccount({ last_synced_at: '2020-01-01', last_sync_attempt_at: todayIn('Europe/Paris') })],
    }

    expect(store.hasStaleSync).toBe(false)
  })

  it('is stale again the day after a failed attempt', () => {
    const store = useBankStore()
    store.summary = {
      total_balance: 0,
      accounts: [anAccount({ last_synced_at: '2020-01-01', last_sync_attempt_at: '2020-01-02' })],
    }

    expect(store.hasStaleSync).toBe(true)
  })

  it('falls back to the browser timezone instead of throwing on an invalid one', () => {
    useDisplayTimezone().setDisplayTimezone('Not/AZone')
    const store = useBankStore()
    store.summary = { total_balance: 0, accounts: [anAccount({ last_synced_at: '2020-01-01' })] }

    expect(() => store.hasStaleSync).not.toThrow()
    expect(store.hasStaleSync).toBe(true)
  })
})

describe('useBankStore — syncBanking', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('keeps each account outcome: the API answers 200 even when every one failed', async () => {
    const { apiClient } = await import('@/api/client')
    vi.mocked(apiClient.post).mockResolvedValue({
      synced: 0,
      results: [
        { bank_account_uuid: 'acc-1', status: 'error', detail: 'pas de solde comptable' },
        { bank_account_uuid: 'acc-2', status: 'skipped_daily_cap', detail: null },
      ],
    })
    vi.mocked(apiClient.get).mockResolvedValue({ total_balance: 0, accounts: [] })

    const store = useBankStore()
    // A failing sync is still a successful call: the failure is in the payload,
    // and reporting it as a network error would hide which account it concerns.
    expect(await store.syncBanking()).toBe(true)
    expect(store.syncResultByAccount['acc-1'].detail).toBe('pas de solde comptable')
    expect(store.syncResultByAccount['acc-2'].status).toBe('skipped_daily_cap')
  })

  it('drops the previous run rather than leaving a stale failure on screen', async () => {
    const { apiClient } = await import('@/api/client')
    vi.mocked(apiClient.get).mockResolvedValue({ total_balance: 0, accounts: [] })

    const store = useBankStore()
    vi.mocked(apiClient.post).mockResolvedValue({
      synced: 0,
      results: [{ bank_account_uuid: 'acc-1', status: 'error', detail: 'boom' }],
    })
    await store.syncBanking()

    vi.mocked(apiClient.post).mockResolvedValue({ synced: 1, results: [] })
    await store.syncBanking()

    expect(store.syncResultByAccount).toEqual({})
  })
})

describe('useBankStore — fetchObservedFlows', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    // The cache is a module singleton: without this, one test's entry answers
    // the next one's first call and the request counts below mean nothing.
    clearCache()
    vi.clearAllMocks()
  })

  function someFlows(overrides = {}) {
    return {
      currency: 'EUR',
      months: [],
      inflow: 0, outflow: 0, net: 0,
      monthly_inflow: 0, monthly_outflow: 0,
      covered_months: 1, account_count: 1, account_names: ['Courant'],
      internal_transfers_excluded: 0, internal_transfers_amount: 0,
      pending_count: 0, pending_inflow: 0, pending_outflow: 0,
      other_currencies: [],
      ...overrides,
    }
  }

  it('asks for the requested window', async () => {
    const { apiClient } = await import('@/api/client')
    vi.mocked(apiClient.get).mockResolvedValue(someFlows())

    await useBankStore().fetchObservedFlows(24)

    expect(apiClient.get).toHaveBeenCalledWith('/banking/flows?months=24')
  })

  it('serves the same window from cache rather than asking twice', async () => {
    const { apiClient } = await import('@/api/client')
    vi.mocked(apiClient.get).mockResolvedValue(someFlows())

    const store = useBankStore()
    await store.fetchObservedFlows(12)
    await store.fetchObservedFlows(12)

    expect(vi.mocked(apiClient.get)).toHaveBeenCalledTimes(1)
  })

  it('goes stale when the movements behind it change', async () => {
    const { apiClient } = await import('@/api/client')
    vi.mocked(apiClient.get).mockResolvedValue(someFlows())

    const store = useBankStore()
    await store.fetchObservedFlows(12)
    // A sync or an import rewrites the very rows these figures are summed from.
    store.invalidateHistoryCache()
    await store.fetchObservedFlows(12)

    expect(vi.mocked(apiClient.get)).toHaveBeenCalledTimes(2)
  })

  it('keeps the transfers reported apart from the totals', async () => {
    const { apiClient } = await import('@/api/client')
    vi.mocked(apiClient.get).mockResolvedValue(
      someFlows({ outflow: 30, internal_transfers_excluded: 1, internal_transfers_amount: 400 }),
    )

    const store = useBankStore()
    await store.fetchObservedFlows(6)

    expect(store.observedFlows?.outflow).toBe(30)
    expect(store.observedFlows?.internal_transfers_amount).toBe(400)
  })
})

describe('useBankStore — fetchTransactions', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    clearCache()
    vi.clearAllMocks()
  })

  function aMonth(): BankTransactionsResponse {
    return {
      period: '2026-09', currency: 'EUR', inflow: 0, outflow: 0, net: 0,
      internal_transfers_excluded: 0, internal_transfers_amount: 0,
      pending_count: 0, pending_inflow: 0, pending_outflow: 0,
      other_currencies: [], transactions: [],
    }
  }

  it('asks for one month, narrowed to the account when one is given', async () => {
    const { apiClient } = await import('@/api/client')
    vi.mocked(apiClient.get).mockResolvedValue(aMonth())

    const store = useBankStore()
    await store.fetchTransactions('2026-09')
    await store.fetchTransactions('2026-09', 'acc-1')

    expect(vi.mocked(apiClient.get).mock.calls.map(([url]) => url)).toEqual([
      '/banking/transactions?period=2026-09',
      '/banking/transactions?period=2026-09&account_id=acc-1',
    ])
  })

  it('keeps the newer filter when an older answer lands last', async () => {
    const { apiClient } = await import('@/api/client')
    let answerAll: (value: BankTransactionsResponse) => void = () => {}
    vi.mocked(apiClient.get)
      .mockImplementationOnce(() => new Promise((resolve) => { answerAll = resolve }))
      .mockResolvedValueOnce({ ...aMonth(), net: 42 })

    const store = useBankStore()
    const slow = store.fetchTransactions('2026-09')
    await store.fetchTransactions('2026-09', 'acc-1')
    answerAll({ ...aMonth(), net: -1 })
    await slow

    expect(store.transactionsKey).toBe('2026-09:acc-1')
    expect(store.transactions?.net).toBe(42)
  })

  it('says when the month could not be loaded', async () => {
    const { apiClient } = await import('@/api/client')
    vi.mocked(apiClient.get).mockRejectedValue(new Error('Compte bancaire introuvable.'))

    const store = useBankStore()

    expect(await store.fetchTransactions('2026-09', 'gone')).toBe(false)
    expect(store.transactionsKey).toBeNull()
    expect(store.transactionsLoading).toBe(false)
  })

  it('signals the tabs to reload whenever the movements change', () => {
    const store = useBankStore()
    const before = store.dataRevision

    store.invalidateHistoryCache()

    expect(store.dataRevision).toBe(before + 1)
  })

  it('goes stale with the flows when the movements change', async () => {
    const { apiClient } = await import('@/api/client')
    vi.mocked(apiClient.get).mockResolvedValue(aMonth())

    const store = useBankStore()
    await store.fetchTransactions('2026-09')
    store.invalidateHistoryCache()
    await store.fetchTransactions('2026-09')

    expect(vi.mocked(apiClient.get)).toHaveBeenCalledTimes(2)
  })
})
