import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { apiClient } from '@/api/client'
import { useDisplayTimezone } from '@/composables/useDisplayTimezone'
import {
  getOrFetchCached,
  invalidateCacheKey,
  invalidateCachePrefix,
  isCacheEntryValid,
} from '@/services/cache'
import type {
  AspspSummary,
  BankAccountResponse,
  BankAccountLinkRequest,
  BankAccountLinkResult,
  BankAccountSyncResult,
  BankAuthorizeResponse,
  BankExportImportResponse,
  BankSessionAccount,
  BankSyncResponse,
  BankSummaryResponse,
  BankAccountCreate,
  BankAccountUpdate,
  AccountHistorySnapshotResponse,
} from '@/types'

// Cache TTL: 1 hour — bank history updates are not real-time for most users.
const CACHE_TTL_MS = 60 * 60 * 1000

export const useBankStore = defineStore('bank', () => {
  const { effectiveTimezone } = useDisplayTimezone()
  const summary = ref<BankSummaryResponse | null>(null)
  const currentAccount = ref<BankAccountResponse | null>(null)
  const history = ref<AccountHistorySnapshotResponse[]>([])
  const accountHistoryById = ref<Record<string, AccountHistorySnapshotResponse[]>>({})
  const isLoading = ref(false)
  const historyLoading = ref(false)
  const isSyncing = ref(false)
  const error = ref<string | null>(null)
  const historyCacheKey = 'bank:history:global'

  /**
   * The last synchronisation's outcome per CapitalView account uuid.
   *
   * `POST /banking/sync` is a 200 whatever happened to each account, so a lost
   * consent or a bank that publishes no usable balance used to be a silent
   * no-op: the page redrew unchanged and said nothing. Kept until the next
   * sync, and only ever populated by one — an account absent from this map has
   * not been attempted in this sitting, which is not the same as "it worked".
   */
  const syncResultByAccount = ref<Record<string, BankAccountSyncResult>>({})

  const linkedAccounts = computed(() =>
    (summary.value?.accounts ?? []).filter((account) => account.is_linked),
  )

  /**
   * Today in the display timezone, as YYYY-MM-DD. The UTC date would disagree
   * with the user's own day between local midnight and the UTC offset.
   */
  function todayLocal(): string {
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }
    let formatter: Intl.DateTimeFormat
    try {
      formatter = new Intl.DateTimeFormat('en-CA', { ...options, timeZone: effectiveTimezone.value })
    } catch {
      // An unknown IANA name throws: fall back to the browser's own zone.
      formatter = new Intl.DateTimeFormat('en-CA', options)
    }
    const parts = formatter.formatToParts(new Date())
    const part = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
    return `${part('year')}-${part('month')}-${part('day')}`
  }

  /** At least one linked account has not been synced today. */
  const hasStaleSync = computed(() => {
    const today = todayLocal()
    return linkedAccounts.value.some((a) => !a.last_synced_at || a.last_synced_at < today)
  })

  const isHistoryCacheValid = computed(() => {
    if (history.value.length === 0) return false
    return isCacheEntryValid(historyCacheKey)
  })

  function isAccountHistoryCacheValid(accountId: string): boolean {
    const cached = accountHistoryById.value[accountId]
    if (!cached || cached.length === 0) return false
    return isCacheEntryValid(`bank:history:account:${accountId}`)
  }

  async function fetchAccounts(): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      summary.value = await apiClient.get<BankSummaryResponse>('/bank/accounts')
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Erreur lors du chargement des comptes'
    } finally {
      isLoading.value = false
    }
  }

  async function fetchAccount(id: string): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      currentAccount.value = await apiClient.get<BankAccountResponse>(`/bank/accounts/${id}`)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Erreur lors du chargement du compte'
    } finally {
      isLoading.value = false
    }
  }

  async function createAccount(data: BankAccountCreate): Promise<BankAccountResponse | null> {
    isLoading.value = true
    error.value = null
    try {
      const account = await apiClient.post<BankAccountResponse>('/bank/accounts', data)
      await fetchAccounts()
      invalidateHistoryCache()
      return account
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Erreur lors de la création du compte'
      return null
    } finally {
      isLoading.value = false
    }
  }

  async function updateAccount(id: string, data: BankAccountUpdate): Promise<BankAccountResponse | null> {
    isLoading.value = true
    error.value = null
    try {
      const account = await apiClient.put<BankAccountResponse>(`/bank/accounts/${id}`, data)
      await fetchAccounts()
      invalidateHistoryCache()
      return account
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Erreur lors de la mise à jour'
      return null
    } finally {
      isLoading.value = false
    }
  }

  async function deleteAccount(id: string): Promise<boolean> {
    isLoading.value = true
    error.value = null
    try {
      await apiClient.delete(`/bank/accounts/${id}`)
      await fetchAccounts()
      invalidateHistoryCache()
      return true
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Erreur lors de la suppression'
      return false
    } finally {
      isLoading.value = false
    }
  }

  async function fetchHistory(force = false): Promise<void> {
    historyLoading.value = true
    error.value = null
    try {
      const data = await getOrFetchCached<AccountHistorySnapshotResponse[]>(
        historyCacheKey,
        () => apiClient.get<AccountHistorySnapshotResponse[]>('/bank/history'),
        CACHE_TTL_MS,
        force,
      )
      history.value = [...data].sort((a, b) =>
        new Date(a.snapshot_date).getTime() - new Date(b.snapshot_date).getTime(),
      )
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Erreur lors du chargement de l\'historique'
    } finally {
      historyLoading.value = false
    }
  }

  async function fetchHistoryForAccount(accountId: string, force = false): Promise<void> {
    historyLoading.value = true
    error.value = null
    try {
      const data = await getOrFetchCached<AccountHistorySnapshotResponse[]>(
        `bank:history:account:${accountId}`,
        () => apiClient.get<AccountHistorySnapshotResponse[]>(`/bank/accounts/${accountId}/history`),
        CACHE_TTL_MS,
        force,
      )
      accountHistoryById.value[accountId] = [...data].sort((a, b) =>
        new Date(a.snapshot_date).getTime() - new Date(b.snapshot_date).getTime(),
      )
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Erreur lors du chargement de l\'historique'
    } finally {
      historyLoading.value = false
    }
  }

  /**
   * Enable Banking synchronisation. The daily cap is re-checked server-side, so
   * a second call the same day is a no-op rather than an error.
   */
  async function syncBanking(): Promise<boolean> {
    isSyncing.value = true
    error.value = null
    try {
      const response = await apiClient.post<BankSyncResponse>('/banking/sync')
      syncResultByAccount.value = Object.fromEntries(
        (response?.results ?? []).map((result) => [result.bank_account_uuid, result]),
      )
      await fetchAccounts()
      invalidateHistoryCache()
      return true
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Erreur lors de la synchronisation bancaire'
      return false
    } finally {
      isSyncing.value = false
    }
  }

  /**
   * Enable Banking JSON export, for the history the API window cannot reach.
   * Same after-effects as a sync: balances and curves move.
   */
  async function importBankingExport(
    payload: unknown,
  ): Promise<BankExportImportResponse> {
    const result = await apiClient.post<BankExportImportResponse>('/banking/import-export', payload)
    await fetchAccounts()
    invalidateHistoryCache()
    return result
  }

  async function fetchAspsps(country: string): Promise<AspspSummary[]> {
    return apiClient.get<AspspSummary[]>(`/banking/aspsps?country=${encodeURIComponent(country)}`)
  }

  /** Opens the journey: the browser has to navigate to the returned URL. */
  async function authorizeBank(aspspName: string, aspspCountry: string): Promise<string> {
    const result = await apiClient.post<BankAuthorizeResponse>('/banking/authorize', {
      aspsp_name: aspspName,
      aspsp_country: aspspCountry,
    })
    return result.auth_url
  }

  async function fetchSessionAccounts(bankSessionUuid: string): Promise<BankSessionAccount[]> {
    return apiClient.get<BankSessionAccount[]>(`/banking/sessions/${bankSessionUuid}/accounts`)
  }

  async function linkSessionAccount(
    bankSessionUuid: string,
    data: BankAccountLinkRequest,
  ): Promise<BankAccountLinkResult> {
    return apiClient.post<BankAccountLinkResult>(
      `/banking/sessions/${bankSessionUuid}/link`, data,
    )
  }

  function invalidateHistoryCache(): void {
    invalidateCacheKey(historyCacheKey)
    invalidateCachePrefix('bank:history:account:')
  }

  function reset(): void {
    summary.value = null
    currentAccount.value = null
    history.value = []
    accountHistoryById.value = {}
    invalidateHistoryCache()
    error.value = null
  }

  return {
    summary,
    currentAccount,
    history,
    accountHistoryById,
    isLoading,
    historyLoading,
    isSyncing,
    error,
    isHistoryCacheValid,
    linkedAccounts,
    syncResultByAccount,
    hasStaleSync,
    fetchAccounts,
    fetchAccount,
    createAccount,
    updateAccount,
    deleteAccount,
    fetchHistory,
    fetchHistoryForAccount,
    syncBanking,
    importBankingExport,
    fetchAspsps,
    authorizeBank,
    fetchSessionAccounts,
    linkSessionAccount,
    invalidateHistoryCache,
    reset,
  }
})
