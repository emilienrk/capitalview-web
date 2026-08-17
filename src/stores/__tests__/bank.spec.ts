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
