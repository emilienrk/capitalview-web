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
  BankAccountUnlinkResult,
  BankAuthorizeResponse,
  BankFlowsResponse,
  BankTransactionItem,
  BankTransactionsResponse,
  BankTransferDecisionKind,
  BankTransferQuestionsResponse,
  BankExportImportResponse,
  BankSessionAccount,
  BankSyncResponse,
  BankSummaryResponse,
  BankAccountCreate,
  BankAccountUpdate,
  SavingsInterestResponse,
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
  /** This year's interest per savings account that has a rate, from GET /bank/interest. */
  const interestByAccount = ref<Record<string, SavingsInterestResponse>>({})

  /** What actually moved, from GET /banking/flows. Null until first asked. */
  const observedFlows = ref<BankFlowsResponse | null>(null)
  const observedFlowsLoading = ref(false)
  /** What `observedFlows` answers, as `months:account` ('all' for every account). */
  const observedFlowsKey = ref<string | null>(null)
  /** The month shown on the Opérations tab, from GET /banking/transactions. */
  const transactions = ref<BankTransactionsResponse | null>(null)
  /** What `transactions` answers, as `period:account` ('all' for every account). */
  const transactionsKey = ref<string | null>(null)
  const transactionsLoading = ref(false)
  // The last filter asked for. Not reactive: only ever compared on arrival.
  let latestFlowsRequest = ''
  let latestTransactionsRequest = ''
  /**
   * Bumped whenever the stored movements or balances may have changed — a sync,
   * an import, an account created or deleted. Each tab of the Banque section
   * watches it to reload what it shows, whichever one fired the change.
   */
  const dataRevision = ref(0)
  const historyCacheKey = 'bank:history:global'

  /**
   * The last synchronisation's outcome per CapitalView account uuid.
   *
   * `POST /banking/sync` is a 200 whatever happened to each account, so a lost
   * consent would otherwise go unsaid. Kept until the next
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
  // A failed attempt spends the day as much as a success does: reading the
  // success date alone kept a failing account due, and the page called the bank
  // again on every render for an answer that had not changed.
  const hasStaleSync = computed(() => {
    const today = todayLocal()
    return linkedAccounts.value.some((a) => {
      const synced = a.last_synced_at ?? ''
      const attempted = a.last_sync_attempt_at ?? ''
      // ISO dates compare as strings; '' stands for "never".
      const lastCall = synced > attempted ? synced : attempted
      return !lastCall || lastCall < today
    })
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

  async function fetchInterest(): Promise<void> {
    try {
      const rows = await apiClient.get<SavingsInterestResponse[]>('/bank/interest')
      interestByAccount.value = Object.fromEntries(rows.map((row) => [row.account_id, row]))
    } catch {
      // An estimate is an extra: the accounts stand without it.
      interestByAccount.value = {}
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

  /** The user's word that an imported account missed nothing up to today. */
  async function confirmUpToDate(id: string): Promise<boolean> {
    try {
      await apiClient.post(`/bank/accounts/${id}/up-to-date`, {})
      invalidateHistoryCache()
      return true
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Erreur lors de la confirmation'
      return false
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

  /**
   * Observed inflow and outflow, month by month, from the stored movements.
   *
   * Read-only and independent of the opt-in: it reaches no bank and touches no
   * credential, so it answers even for someone who switched the feature back
   * off — the history is still theirs.
   */
  async function fetchObservedFlows(months = 12, force = false, accountId: string | null = null): Promise<void> {
    const key = `${months}:${accountId ?? 'all'}`
    latestFlowsRequest = key
    observedFlowsLoading.value = true
    const accountQuery = accountId ? `&account_id=${encodeURIComponent(accountId)}` : ''
    try {
      const flows = await getOrFetchCached<BankFlowsResponse>(
        `bank:flows:${key}`,
        () => apiClient.get<BankFlowsResponse>(`/banking/flows?months=${months}${accountQuery}`),
        CACHE_TTL_MS,
        force,
      )
      // A slower answer to a filter already replaced must not overwrite the newer one.
      if (latestFlowsRequest !== key) return
      observedFlows.value = flows
      observedFlowsKey.value = key
    } catch (e) {
      if (latestFlowsRequest !== key) return
      error.value = e instanceof Error ? e.message : 'Erreur lors du chargement des mouvements'
    } finally {
      if (latestFlowsRequest === key) observedFlowsLoading.value = false
    }
  }

  /**
   * One month of operations, all accounts or one. Same lifetime as the flows.
   * False when the request failed, so the page can stop waiting for it.
   */
  async function fetchTransactions(period: string, accountId: string | null = null, force = false): Promise<boolean> {
    const key = `${period}:${accountId ?? 'all'}`
    latestTransactionsRequest = key
    transactionsLoading.value = true
    const accountQuery = accountId ? `&account_id=${encodeURIComponent(accountId)}` : ''
    try {
      const month = await getOrFetchCached<BankTransactionsResponse>(
        `bank:flows:transactions:${key}`,
        () => apiClient.get<BankTransactionsResponse>(`/banking/transactions?period=${period}${accountQuery}`),
        CACHE_TTL_MS,
        force,
      )
      if (latestTransactionsRequest === key) {
        transactions.value = month
        transactionsKey.value = key
      }
      return true
    } catch (e) {
      if (latestTransactionsRequest === key) {
        error.value = e instanceof Error ? e.message : 'Erreur lors du chargement des opérations'
      }
      return false
    } finally {
      if (latestTransactionsRequest === key) transactionsLoading.value = false
    }
  }

  /** The pairs waiting for the user across the whole history, for the tab's badge. */
  const transferQuestions = ref<BankTransferQuestionsResponse | null>(null)

  async function fetchTransferQuestions(): Promise<void> {
    try {
      transferQuestions.value = await apiClient.get<BankTransferQuestionsResponse>('/banking/transfer-questions')
    } catch {
      // A badge that cannot load stays hidden: nothing else depends on it.
      transferQuestions.value = null
    }
  }

  /** The operations that could be bound to this one, nearest first. */
  async function fetchTransferCounterparts(transactionId: string): Promise<BankTransactionItem[]> {
    return apiClient.get<BankTransactionItem[]>(
      `/banking/transactions/${encodeURIComponent(transactionId)}/counterparts`,
    )
  }

  /**
   * Settles two operations, replacing what was decided about them before. The
   * pairing of every month may move — a decision also teaches the labels — so
   * all observed flows go stale, and the pages listening to `dataRevision` reload.
   */
  async function decideTransfer(
    transactionId: string,
    otherTransactionId: string,
    kind: BankTransferDecisionKind,
  ): Promise<void> {
    await apiClient.post('/banking/transfer-decisions', {
      transaction_id: transactionId,
      other_transaction_id: otherTransactionId,
      kind,
    })
    operationsRead()
  }

  /**
   * How operations are read moved — a pair settled, a type given: every
   * observed flow goes stale, the pages listening to `dataRevision` reload, and
   * the questions are counted again.
   */
  function operationsRead(): void {
    invalidateCachePrefix('bank:flows:')
    dataRevision.value += 1
    void fetchTransferQuestions()
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

  /**
   * Detach one account, leaving the authorization live for the others.
   *
   * Whatever the detached account had shadowed through cross-account
   * deduplication is unreachable until its counterpart is re-seeded, which the
   * API schedules on its own — hence the accounts refresh here.
   */
  async function unlinkAccount(
    bankAccountUuid: string,
    deleteTransactions: boolean,
  ): Promise<BankAccountUnlinkResult> {
    const result = await apiClient.delete<BankAccountUnlinkResult>(
      `/banking/accounts/${bankAccountUuid}/link?delete_transactions=${deleteTransactions}`,
    )
    delete syncResultByAccount.value[bankAccountUuid]
    await fetchAccounts()
    invalidateHistoryCache()
    return result
  }

  /**
   * Ask the bank for an account's whole history again on the next sync.
   *
   * Nothing is deleted; the seeding pass rewrites the window it can reach. For
   * the account whose first sync came back empty and has been synchronising
   * over a history it never received ever since.
   */
  /** Give a failed account its daily attempt back, then sync. */
  async function retrySync(bankAccountUuid: string): Promise<void> {
    await apiClient.post(`/banking/accounts/${bankAccountUuid}/retry-sync`, {})
    await syncBanking()
  }

  async function reseedHistory(bankAccountUuid: string): Promise<void> {
    await apiClient.post(`/banking/accounts/${bankAccountUuid}/reseed-history`, {})
    await syncBanking()
    await fetchAccounts()
    invalidateHistoryCache()
  }

  function invalidateHistoryCache(): void {
    dataRevision.value += 1
    invalidateCacheKey(historyCacheKey)
    invalidateCachePrefix('bank:history:account:')
    // The observed flows are built from the same movements a sync or an import
    // just changed, so they go stale at exactly the same moments.
    invalidateCachePrefix('bank:flows:')
  }

  function reset(): void {
    summary.value = null
    currentAccount.value = null
    history.value = []
    accountHistoryById.value = {}
    interestByAccount.value = {}
    observedFlows.value = null
    observedFlowsKey.value = null
    transactions.value = null
    transactionsKey.value = null
    transferQuestions.value = null
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
    interestByAccount,
    isHistoryCacheValid,
    observedFlows,
    observedFlowsLoading,
    observedFlowsKey,
    transactions,
    transactionsKey,
    transactionsLoading,
    dataRevision,
    linkedAccounts,
    syncResultByAccount,
    hasStaleSync,
    fetchAccounts,
    fetchAccount,
    fetchInterest,
    createAccount,
    updateAccount,
    deleteAccount,
    confirmUpToDate,
    fetchHistory,
    fetchHistoryForAccount,
    syncBanking,
    retrySync,
    fetchObservedFlows,
    fetchTransactions,
    importBankingExport,
    transferQuestions,
    fetchTransferQuestions,
    fetchTransferCounterparts,
    decideTransfer,
    operationsRead,
    fetchAspsps,
    authorizeBank,
    fetchSessionAccounts,
    linkSessionAccount,
    unlinkAccount,
    reseedHistory,
    invalidateHistoryCache,
    reset,
  }
})
