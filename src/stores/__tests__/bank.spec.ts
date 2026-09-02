import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useBankStore } from '@/stores/bank'
import { useDisplayTimezone } from '@/composables/useDisplayTimezone'
import type { BankAccountResponse } from '@/types'

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
