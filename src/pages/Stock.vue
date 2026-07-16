<script setup lang="ts">
import { Pencil, TrendingUp, Upload, Banknote, RefreshCw, ChevronLeft, ChevronRight, Camera } from 'lucide-vue-next'

import { onMounted, ref, reactive, computed, watch } from 'vue'
import { apiClient } from '@/api/client'
import { useStocksStore } from '@/stores/stocks'
import { useBankStore } from '@/stores/bank'
import { useHistoryGranularity } from '@/composables/useHistoryGranularity'
import { useCarousel } from '@/composables/useCarousel'
import { useStatsPager, type SummaryStatItem } from '@/composables/useStatsPager'
import { useConfirm } from '@/composables/useConfirm'
import { useFormatters } from '@/composables/useFormatters'
import { useCurrencyToggle } from '@/composables/useCurrencyToggle'
import { usePrivacyMode } from '@/composables/usePrivacyMode'
import { useDarkMode } from '@/composables/useDarkMode'
import PageHeader from '@/components/PageHeader.vue'
import {
  BaseCard, BaseAlert, BaseButton, BaseAddButton, BaseEmptyState, BaseBadge, BaseInput, BaseSelect, BaseModal,
  BaseSkeleton, BaseSegmentedControl, BaseTextarea, BaseStatCard, ChartPerformanceBadge,
  BaseSpinner, BaseAutocomplete,
} from '@/components'
import CsvImportModal from '@/components/modals/CsvImportModal.vue'
import PlatformImportModal from '@/components/imports/PlatformImportModal.vue'
import PhotoImportModal from '@/components/modals/PhotoImportModal.vue'
import HistoryLineChart from '@/components/charts/HistoryLineChart.vue'
import AllocationDonutChart from '@/components/charts/AllocationDonutChart.vue'
import type { StockAccountCreate, StockTransactionCreate, StockAccountType, TransactionResponse, AssetSearchResult, StockTransactionBulkCreate, PositionResponse, EurDepositCreate, AccountHistorySnapshotResponse, AccountSummaryResponse } from '@/types'


const stocks = useStocksStore()
const bank = useBankStore()
const { formatCurrency, formatPercent, formatNumber, formatDate, profitLossClass } = useFormatters()
const { displayCurrency, usdToEurRate, fetchRate } = useCurrencyToggle()
const { privacyMode, togglePrivacyMode, maskValue } = usePrivacyMode()
const { isDark } = useDarkMode()
const { confirmDialog } = useConfirm()

// ── State ────────────────────────────────────────────────────
const showAccountModal = ref(false)
const showTxModal = ref(false)
const showDeleteModal = ref(false)
const showCsvImportModal = ref(false)
const showPlatformImportModal = ref(false)
const platformImportAccountId = ref('')
const showPhotoImportModal = ref(false)
const photoImportAccountId = ref<string | null>(null)
const showDepositModal = ref(false)
const depositAccountId = ref<string | null>(null)
const depositStockAccountId = ref<string | null>(null)
const editingDepositId = ref<string | null>(null)
const deductFromBank = ref(true)
const selectedBankAccountId = ref<string | null>(null)
const csvImportAccountId = ref<string | null>(null)
const deleteTarget = ref<{ type: 'account' | 'transaction'; id: string; label: string } | null>(null)
const selectedAccountId = ref<string | null>(null)
const activeFilter = ref<'all' | 'PEA' | 'CTO' | 'PEA_PME'>('all')
const accountTransactions = ref<TransactionResponse[]>([])
const activeDetailTab = ref<'positions' | 'history'>('positions')
type StockChartSlide = 'evolution' | 'allocation' | 'pnl' | 'cumulative_pnl'
const stockChartSlides: Array<{ key: StockChartSlide; label: string }> = [
  { key: 'evolution', label: 'Évolution' },
  { key: 'allocation', label: 'Répartition' },
  { key: 'pnl', label: 'P/L journalier' },
  { key: 'cumulative_pnl', label: 'P/L cumulé' },
]
const {
  current: stockChartSlide,
  currentLabel: stockChartSlideLabel,
  next: nextStockChartSlide,
  prev: prevStockChartSlide,
  swipeHandlers: stockChartSwipe,
} = useCarousel(stockChartSlides)
const {
  granularity: historyGranularity,
  granularityOptions,
  applyGranularity,
} = useHistoryGranularity(() => stocks.history ?? [])
const editingTxId = ref<string | null>(null)
const editingAccountId = ref<string | null>(null)
const showMobilePnlLabels = ref(false)
/** Inline validation error shown inside the transaction modal. */
const txFormError = ref<string | null>(null)
/** Inline validation error shown inside the account modal. */
const accountFormError = ref<string | null>(null)
/** Inline validation error shown inside the deposit modal. */
const depositFormError = ref<string | null>(null)

const accountForm = reactive<StockAccountCreate>({
  name: '',
  account_type: 'CTO' as StockAccountType,
  institution_name: '',
  identifier: '',
  opened_at: null,
})

const txForm = reactive<StockTransactionCreate>({
  account_id: '',
  symbol: '',
  asset_key: '',
  exchange: '',
  type: 'BUY',
  amount: 0,
  price_per_unit: 0,
  fees: 0,
  executed_at: new Date().toISOString().slice(0, 16),
})

const depositForm = reactive<EurDepositCreate>({
  amount: 0,
  fees: 0,
  executed_at: new Date().toISOString().slice(0, 16),
  notes: '',
})

/** Sorted bank accounts: CHECKING first, then others */
const sortedBankAccounts = computed(() => {
  const accounts = bank.summary?.accounts ?? []
  return [...accounts].sort((a, b) => {
    if (a.account_type === 'CHECKING') return -1
    if (b.account_type === 'CHECKING') return 1
    return 0
  })
})

// ── Unified asset search ─────────────────────────────────────
interface AssetOption {
  symbol: string
  asset_key: string | null
  name: string | null
  exchange: string | null
  _source: 'known' | 'api'
}
const assetQuery = ref('')
const assetOptions = ref<AssetOption[]>([])
const isAssetSearching = ref(false)
const assetError = ref<string | null>(null)
const showExchange = ref(false)

// ── Dividend mode ────────────────────────────────────────────
const dividendMode = ref<'cash' | 'shares'>('cash')

// ── Options ──────────────────────────────────────────────────
const txTypeOptions = [
  { label: 'Achat', value: 'BUY' },
  { label: 'Vente', value: 'SELL' },
  { label: 'Dividende', value: 'DIVIDEND' },
]

const accountTypeLabels: Record<string, string> = {
  PEA: 'PEA',
  CTO: 'Compte-Titres',
  PEA_PME: 'PEA-PME',
}

// ── Computed ─────────────────────────────────────────────────

/** Check if user already has a PEA account */
const hasPea = computed(() =>
  stocks.accounts.some((a) => a.account_type === 'PEA'),
)

/** Check if user already has a PEA-PME account */
const hasPeaPme = computed(() =>
  stocks.accounts.some((a) => a.account_type === 'PEA_PME'),
)

/** Available account types for creation */
const availableAccountTypes = computed(() => [
  { label: 'Compte-Titres (CTO)', value: 'CTO' },
  { label: 'PEA', value: 'PEA', disabled: hasPea.value },
  { label: 'PEA-PME', value: 'PEA_PME', disabled: hasPeaPme.value },
])

/** Filtered accounts based on active tab */
const filteredAccounts = computed(() => {
  if (activeFilter.value === 'all') return stocks.accounts
  return stocks.accounts.filter((a) => a.account_type === activeFilter.value)
})

/** Portfolio totals from currentAccount data (when selected) */
const selectedAccountSummary = computed(() => stocks.currentAccount)

const selectedStockAccountMeta = computed(() => {
  if (!selectedAccountId.value) return null
  return stocks.accounts.find((account) => account.id === selectedAccountId.value) ?? null
})

function latestDailyPnlFromHistory(history: AccountHistorySnapshotResponse[]): number | null {
  for (let idx = history.length - 1; idx >= 0; idx -= 1) {
    const snapshot = history[idx]
    if (!snapshot) continue
    const dailyPnl = parsePnlValue(snapshot.daily_pnl)
    if (dailyPnl != null) return dailyPnl
  }
  return null
}

/** Deduplicated list of known assets from existing transactions, shown by default in the asset picker */
const knownAssetOptions = computed((): AssetOption[] => {
  const seen = new Map<string, AssetOption>()

  // 1. Add all currently owned assets from the selected account first to ensure they are always present and up to date
  for (const pos of ownedAssetOptions.value) {
    const key = pos.asset_key || `${pos.symbol}__${pos.exchange ?? ''}`
    if (!seen.has(key)) {
      seen.set(key, {
        symbol: pos.symbol,
        asset_key: pos.asset_key,
        name: pos.name,
        exchange: pos.exchange,
        _source: 'known',
      })
    }
  }

  // 2. Add other assets from the transaction history
  for (const tx of stocks.transactions) {
    if (tx.asset_key === 'EUR') continue  // EUR cash is not a tradable asset
    const key = tx.asset_key || `${tx.symbol}__${tx.exchange ?? ''}`
    if (!seen.has(key)) {
      seen.set(key, {
        symbol: tx.symbol || '',
        asset_key: tx.asset_key,
        name: tx.name,
        exchange: tx.exchange,
        _source: 'known',
      })
    }
  }

  // Helper to check if an asset is currently owned in the selected account
  const isOwned = (asset: AssetOption) => {
    return ownedAssetOptions.value.some((o: AssetOption) =>
      (asset.asset_key && o.asset_key === asset.asset_key) ||
      (!asset.asset_key && o.symbol === asset.symbol)
    )
  }

  return Array.from(seen.values())
    .sort((a, b) => {
      const aOwned = isOwned(a)
      const bOwned = isOwned(b)
      if (aOwned && !bOwned) return -1
      if (!aOwned && bOwned) return 1
      return (a.name ?? a.symbol).localeCompare(b.name ?? b.symbol)
    })
})

function formatAssetOption(opt: AssetOption): string {
  return opt.name || opt.symbol || opt.asset_key || ''
}

async function handleSelectUnifiedAsset(asset: AssetOption): Promise<void> {
  if (assetSearchTimeout) {
    clearTimeout(assetSearchTimeout)
    assetSearchTimeout = null
  }
  isAssetSearching.value = false

  txForm.symbol = asset.symbol
  txForm.asset_key = asset.asset_key ?? ''
  txForm.exchange = asset.exchange ?? ''
  if (asset.name) txForm.name = asset.name
  assetQuery.value = formatAssetOption(asset)
  assetError.value = null
  if (asset.exchange) showExchange.value = true

  // API search results never include ISIN (Yahoo Finance search doesn't return it).
  // When no ISIN is available, do a follow-up info call to resolve it.
  if (!asset.asset_key) {
    const selectedSymbol = asset.symbol
    try {
      const info = await stocks.getAssetsInfo([selectedSymbol])
      const firstInfo = info[0]
      // Guard: don't overwrite if the user already changed the asset
      if (txForm.symbol === selectedSymbol && firstInfo?.asset_key) {
        txForm.asset_key = firstInfo.asset_key
      }
    } catch (e) {
      console.error('[ISIN lookup] error:', e)
    }
  }
}

/** Show currency toggle only if current account has at least one non-EUR position */
const canToggleCurrency = computed(() =>
  selectedAccountSummary.value?.positions?.some(p => p.currency && p.currency !== 'EUR') ?? false
)

// ── Currency helpers ─────────────────────────────────────────
/** Convert a position value to EUR using the live rate (assumes non-EUR = USD) */
function posToEur(value: number | string | null | undefined, currency: string): number | null {
  if (value == null) return null
  const n = Number(value)
  if (isNaN(n)) return null
  if (currency && currency !== 'EUR') return n * usdToEurRate.value
  return n
}

/** Format a market price in the active display currency */
function formatPosPrice(value: number | string | null | undefined, currency: string): string {
  const c = currency || 'EUR'
  if (c !== 'EUR' && displayCurrency.value === 'EUR') {
    return formatCurrency(posToEur(value, c), 'EUR')
  }
  return formatCurrency(value, c)
}

/** Format PRU: always entered in EUR, convert to native in USD mode */
function formatPru(avgBuyPrice: number | string, currency: string): string {
  const c = currency || 'EUR'
  if (c !== 'EUR' && displayCurrency.value === 'USD') {
    const rate = usdToEurRate.value
    return formatCurrency(rate > 0 ? Number(avgBuyPrice) / rate : Number(avgBuyPrice), c)
  }
  return formatCurrency(avgBuyPrice, 'EUR')
}

/** P&L in EUR (total_invested is always EUR as entered by user) */
function posProfitLossEur(pos: PositionResponse): number | null {
  if (pos.current_value == null) return null
  return posToEur(pos.current_value, pos.currency) as number - Number(pos.total_invested)
}

function posProfitLossPctEur(pos: PositionResponse): number | null {
  const pl = posProfitLossEur(pos)
  if (pl == null) return null
  const inv = Number(pos.total_invested)
  return inv > 0 ? (pl / inv) * 100 : 0
}

/** Transactions sorted from most recent to oldest. */
const sortedTransactions = computed(() => {
  return [...accountTransactions.value].sort(
    (a, b) => new Date(b.executed_at).getTime() - new Date(a.executed_at).getTime()
  )
})

/** Positions sorted by total invested (descending) — EUR cash excluded, shown separately. */
const sortedPositions = computed(() => {
  if (!selectedAccountSummary.value?.positions) return []
  return [...selectedAccountSummary.value.positions]
    .filter(p => p.asset_key !== 'EUR')
    .sort((a, b) => Number(b.total_invested ?? 0) - Number(a.total_invested ?? 0))
})

const selectedAccountHistory = computed(() => {
  if (!selectedAccountId.value) return []
  return [...(stocks.accountHistoryById[selectedAccountId.value] ?? [])].sort(
    (a, b) => new Date(a.snapshot_date).getTime() - new Date(b.snapshot_date).getTime(),
  )
})

const selectedStockDailyPnl = computed<number | null>(() => {
  return latestDailyPnlFromHistory(selectedAccountHistory.value)
})

const selectedStockOpenedAt = computed<string | null>(() => {
  return selectedStockAccountMeta.value?.opened_at ?? selectedStockAccountMeta.value?.created_at ?? null
})

const stockSummaryStats = computed<SummaryStatItem[]>(() => {
  const summary = selectedAccountSummary.value
  if (!summary) return []

  return [
    {
      key: 'invested',
      label: 'Investi',
      value: maskValue(formatCurrency(summary.total_invested)),
    },
    {
      key: 'current_value',
      label: 'Valeur actuelle',
      value: maskValue(formatCurrency(summary.current_value)),
    },
    {
      key: 'profit_loss',
      label: 'P/L',
      value: maskValue(formatCurrency(summary.profit_loss)),
      valueClass: profitLossClass(summary.profit_loss),
    },
    {
      key: 'performance',
      label: 'Performance',
      value: formatPercent(summary.profit_loss_percentage),
      valueClass: profitLossClass(summary.profit_loss_percentage),
    },
    {
      key: 'daily_pnl',
      label: 'P/L journalier',
      value: maskValue(formatCurrency(selectedStockDailyPnl.value)),
      valueClass: profitLossClass(selectedStockDailyPnl.value),
    },
    {
      key: 'total_deposits',
      label: 'Dépôts cumulés',
      value: maskValue(formatCurrency(summary.total_deposits)),
    },
    {
      key: 'total_withdrawals',
      label: 'Retraits cumulés',
      value: maskValue(formatCurrency(summary.total_withdrawals)),
    },
    {
      key: 'cash_balance',
      label: 'Liquidités',
      value: maskValue(formatCurrency(summary.positions.find((p) => p.asset_key === 'EUR')?.total_amount ?? 0)),
    },
  ]
})

const {
  page: stockSummaryStatsPage,
  pages: stockSummaryStatPages,
  activeStats: activeStockSummaryStats,
  resetPage: resetStockSummaryStatsPage,
} = useStatsPager(stockSummaryStats)

const historyForGranularity = computed<AccountHistorySnapshotResponse[]>(() => {
  return [...(stocks.history ?? [])].sort(
    (a, b) => new Date(a.snapshot_date).getTime() - new Date(b.snapshot_date).getTime(),
  )
})

function parsePnlValue(value: unknown): number | null {
  if (value == null) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const stockDailyPnlPoints = computed<AccountHistorySnapshotResponse[]>(() => {
  const history = historyForGranularity.value
  if (history.length <= 1) return []

  return history
    .slice(1)
    .map((point) => {
      const dailyPnl = parsePnlValue(point.daily_pnl)
      if (dailyPnl == null) return null
      return {
        ...point,
        total_value: dailyPnl,
      }
    })
    .filter((point): point is AccountHistorySnapshotResponse => point != null)
})

const stockCumulativePnlPoints = computed<AccountHistorySnapshotResponse[]>(() => {
  const history = historyForGranularity.value
  if (history.length <= 1) return []

  return history
    .slice(1)
    .map((point) => {
      const cumulativePnl = parsePnlValue(point.cumulative_pnl)
      if (cumulativePnl == null) return null
      return {
        ...point,
        total_value: cumulativePnl,
      }
    })
    .filter((point): point is AccountHistorySnapshotResponse => point != null)
})

const stockDailyPnlAverage = computed(() => {
  const dailyValues = stockDailyPnlPoints.value
    .map((point) => Number(point.total_value))
    .filter((value) => Number.isFinite(value))

  if (!dailyValues.length) return null

  const sum = dailyValues.reduce((acc, value) => acc + value, 0)
  return sum / dailyValues.length
})

const stockLatestPortfolioDailyPnl = computed<number | null>(() => {
  const points = stockDailyPnlPoints.value
  const latest = points[points.length - 1]
  if (!latest) return null
  return Number.isFinite(Number(latest.total_value)) ? Number(latest.total_value) : null
})

const stockDailyPnlSeries = computed(() => {
  const pnlSeries = stockDailyPnlPoints.value

  if (!pnlSeries.length) return []

  const average = stockDailyPnlAverage.value ?? 0
  const averageSeries = pnlSeries.map((point) => ({
    ...point,
    total_value: average,
  }))

  return [
    { name: 'P/L journalier', history: pnlSeries },
    { name: 'Moyenne journalière', history: averageSeries },
  ]
})

const stockAllTimePnlSeries = computed(() => {
  const allTimePnlSeries = applyGranularity(stockCumulativePnlPoints.value)

  if (!allTimePnlSeries.length) return []

  return [
    { name: 'P/L cumulé', history: allTimePnlSeries },
  ]
})

const allocationSegments = computed(() => {
  return (stocks.accounts ?? [])
    .map((account) => {
      const accountHistory = stocks.accountHistoryById[account.id] ?? []
      const latestSnapshot = accountHistory[accountHistory.length - 1]
      return {
        name: account.name,
        value: Number(latestSnapshot?.total_value ?? 0),
      }
    })
    .filter((segment) => segment.value > 0)
    .sort((a, b) => b.value - a.value)
})

const stockChartSeries = computed(() => {
  const totalHistory = applyGranularity(stocks.history)
  const accountSeries = (stocks.accounts ?? [])
    .map((account) => ({
      name: account.name,
      history: applyGranularity(stocks.accountHistoryById[account.id] ?? []),
    }))
    .filter((series) => series.history.length > 0)

  if ((stocks.accounts ?? []).length <= 1) {
    return accountSeries
  }

  const series = [{ name: 'Valeur totale', history: totalHistory }, ...accountSeries]
  return series.filter((line) => line.history.length > 0)
})

async function loadStockChartHistories(force = false): Promise<void> {
  await Promise.all([
    stocks.fetchHistory(force),
    ...stocks.accounts.map((account) => stocks.fetchHistoryForAccount(account.id, force)),
  ])
}

/**
 * After a mutation, refresh only the global history and the affected
 * account instead of force-reloading every account. Other accounts'
 * cache entries are invalidated so any later read refetches lazily.
 */
async function reloadChartsAfterMutation(accountId?: string | null): Promise<void> {
  stocks.invalidateHistoryCache()
  await Promise.all([
    stocks.fetchHistory(true),
    ...(accountId ? [stocks.fetchHistoryForAccount(accountId, true)] : []),
  ])
}

const modalPositions = ref<PositionResponse[]>([])

/** Asset options restricted to positions the user currently holds (for SELL and DIVIDEND). */
const ownedAssetOptions = computed((): AssetOption[] => {
  if (!modalPositions.value) return []
  return modalPositions.value
    .filter(p => p.asset_key !== 'EUR' && Number(p.total_amount) > 0)
    .map(p => ({
      symbol: p.symbol ?? '',
      asset_key: p.asset_key ?? null,
      name: p.name ?? null,
      exchange: p.exchange ?? null,
      _source: 'known' as const,
    }))
    .sort((a, b) => (a.name ?? a.symbol).localeCompare(b.name ?? b.symbol))
})

/** Maximum quantity available for the currently selected asset when selling. */
const sellMaxAmount = computed((): number | null => {
  if (txForm.type !== 'SELL' || !txForm.asset_key) return null
  const pos = modalPositions.value.find(p => p.asset_key === txForm.asset_key)
  return pos ? Number(pos.total_amount) : null
})

/** Dynamic label for the amount field based on transaction type. */
const txAmountLabel = computed(() => {
  if (txForm.type === 'DIVIDEND') {
    return dividendMode.value === 'shares' ? 'Nb actions reçues' : 'Nb actions portées'
  }
  if (txForm.type === 'SELL') return 'Quantité vendue'
  return 'Quantité'
})

/** Whether the current form is a shares dividend (DRIP — stored as BUY at €0). */
const isDividendShares = computed(() => txForm.type === 'DIVIDEND' && dividendMode.value === 'shares')

/** Dynamic label for the price field based on transaction type. */
const txPriceLabel = computed(() => {
  if (txForm.type === 'SELL') return 'Prix de vente unitaire (€)'
  if (txForm.type === 'DIVIDEND') return 'Dividende par action (€)'
  return 'Prix unitaire (€)'
})

// When the transaction type changes, update the asset picker scope
watch(() => txForm.type, (newType) => {
  if (newType === 'SELL' || newType === 'DIVIDEND') {
    // Restrict to owned positions, filtered by the current query if any
    const q = assetQuery.value.trim().toLowerCase()
    assetOptions.value = !q
      ? ownedAssetOptions.value
      : ownedAssetOptions.value.filter(a =>
          (a.symbol?.toLowerCase().includes(q) ?? false) ||
          (a.name?.toLowerCase().includes(q) ?? false) ||
          (a.asset_key?.toLowerCase().includes(q) ?? false)
        )
    // If the currently selected asset is not in owned positions, clear it
    if (txForm.asset_key && !ownedAssetOptions.value.some(a => a.asset_key === txForm.asset_key)) {
      txForm.asset_key = ''
      txForm.symbol = ''
      assetQuery.value = ''
    }
  } else {
    handleAssetInput(assetQuery.value)
  }
  dividendMode.value = 'cash'
})

watch(selectedAccountId, () => {
  resetStockSummaryStatsPage()
})

// ── Actions ──────────────────────────────────────────────────
function openCreateAccount(): void {
  accountFormError.value = null
  editingAccountId.value = null
  accountForm.name = ''
  // Default to CTO, or PEA if no PEA exists yet
  accountForm.account_type = hasPea.value ? 'CTO' : 'PEA'
  accountForm.institution_name = ''
  accountForm.identifier = ''
  accountForm.opened_at = null
  showAccountModal.value = true
}

function openEditAccount(account: any): void {
  accountFormError.value = null
  editingAccountId.value = account.id
  accountForm.name = account.name
  accountForm.account_type = account.account_type
  accountForm.institution_name = account.institution_name || ''
  accountForm.identifier = account.identifier || ''
  accountForm.opened_at = account.opened_at ?? null
  showAccountModal.value = true
}

function checkDateValid(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "Date invalide.";
  if (d.getFullYear() < 2000) return "La date ne peut pas être avant l'année 2000.";
  if (d > new Date()) return "La date ne peut pas être dans le futur.";
  return null;
}

async function handleSubmitAccount(): Promise<void> {
  const dateErr = checkDateValid(accountForm.opened_at)
  if (dateErr) {
    accountFormError.value = dateErr
    return
  }
  accountFormError.value = null
  showAccountModal.value = false
  let result
  if (editingAccountId.value) {
    result = await stocks.updateAccount(editingAccountId.value, { ...accountForm })
  } else {
    result = await stocks.createAccount({ ...accountForm })
  }
  if (!result) {
    showAccountModal.value = true
    return
  }
  if (result) {
    void reloadChartsAfterMutation(editingAccountId.value ?? result.id)
  }
}

async function openAddTransaction(accountId: string): Promise<void> {
  txFormError.value = null
  editingTxId.value = null
  txForm.account_id = accountId
  txForm.symbol = ''
  txForm.asset_key = ''
  txForm.exchange = ''
  txForm.type = 'BUY'
  txForm.amount = 0
  txForm.price_per_unit = 0
  txForm.fees = 0
  txForm.executed_at = new Date().toISOString().slice(0, 16)
  assetQuery.value = ''

  // Load the target account's positions for the modal without expanding the card in the UI
  try {
    if (selectedAccountId.value === accountId && selectedAccountSummary.value) {
      modalPositions.value = selectedAccountSummary.value.positions ?? []
    } else {
      const summary = await apiClient.get<AccountSummaryResponse>(`/stocks/accounts/${accountId}?db_only=true`)
      modalPositions.value = summary.positions ?? []
    }
  } catch (e) {
    console.error('Error loading positions for modal:', e)
    modalPositions.value = []
  }

  assetOptions.value = ownedAssetOptions.value.slice(0, 10)
  assetError.value = null
  showExchange.value = false
  dividendMode.value = 'cash'
  showTxModal.value = true
}

function openCsvImport(accountId?: string): void {
  csvImportAccountId.value = accountId ?? stocks.accounts[0]?.id ?? null
  showCsvImportModal.value = true
}

async function openDeposit(accountId?: string): Promise<void> {
  depositFormError.value = null
  depositAccountId.value = accountId ?? null
  depositStockAccountId.value = accountId ?? stocks.accounts[0]?.id ?? null
  editingDepositId.value = null
  depositForm.amount = 0
  depositForm.fees = 0
  depositForm.executed_at = new Date().toISOString().slice(0, 16)
  depositForm.notes = ''
  deductFromBank.value = true
  // Fetch bank accounts to pre-select
  await bank.fetchAccounts()
  const first = sortedBankAccounts.value[0]
  selectedBankAccountId.value = first?.id ?? null
  showDepositModal.value = true
}

function openEditDeposit(tx: TransactionResponse): void {
  depositFormError.value = null
  depositAccountId.value = selectedAccountId.value
  editingDepositId.value = tx.id
  depositForm.amount = tx.amount
  depositForm.fees = Number(tx.fees ?? 0)
  depositForm.executed_at = tx.executed_at.slice(0, 16)
  depositForm.notes = tx.notes ?? ''
  // Don't deduct from bank: the deduction already happened at creation
  deductFromBank.value = false
  showDepositModal.value = true
}

async function handleSubmitDeposit(): Promise<void> {
  const dateErr = checkDateValid(depositForm.executed_at)
  if (dateErr) {
    depositFormError.value = dateErr
    return
  }

  if (depositForm.amount <= 0) {
    depositFormError.value = 'Le montant doit être strictement positif.'
    return
  }

  if (depositForm.fees < 0) {
    depositFormError.value = 'Les frais doivent être positifs ou nuls.'
    return
  }

  const grossAmount = Number(depositForm.amount)
  const feesAmount = Number(depositForm.fees || 0)
  const netAmountPreview = grossAmount - feesAmount

  if (netAmountPreview <= 0) {
    depositFormError.value = 'Le montant net (montant - frais) doit être strictement positif.'
    return
  }

  depositFormError.value = null

  // Editing an existing deposit
  if (editingDepositId.value) {
    showDepositModal.value = false
    const result = await stocks.updateTransaction(editingDepositId.value, {
      amount: grossAmount,
      fees: feesAmount,
      executed_at: depositForm.executed_at,
      notes: depositForm.notes || undefined,
    })
    if (!result) {
      showDepositModal.value = true
      return
    }
    if (result) {
      if (selectedAccountId.value) {
        await Promise.all([
          stocks.fetchAccount(selectedAccountId.value),
          fetchAccountTransactions(selectedAccountId.value),
        ])
      }
      void reloadChartsAfterMutation(selectedAccountId.value)
    }
    return
  }

  // Check if selected bank account has enough balance
  if (deductFromBank.value && selectedBankAccountId.value) {
    const bankAcc = sortedBankAccounts.value.find(a => a.id === selectedBankAccountId.value)
    if (bankAcc && Number(bankAcc.balance) < grossAmount) {
      const ok = await confirmDialog({
        title: 'Solde insuffisant',
        message: `Le solde du compte « ${bankAcc.name} » (${formatCurrency(bankAcc.balance)}) est insuffisant. Continuer quand même ?`,
        confirmLabel: 'Continuer',
        variant: 'primary',
      })
      if (!ok) return
    }
  }

  // Use stock account selector if opened from header (no pre-set account)
  const targetStockAccountId = depositStockAccountId.value ?? depositAccountId.value
  showDepositModal.value = false
  const result = await stocks.depositEur(targetStockAccountId!, {
    amount: grossAmount,
    fees: feesAmount,
    executed_at: depositForm.executed_at,
    notes: depositForm.notes || undefined,
  })
  if (!result) {
    showDepositModal.value = true
    return
  }
  if (result) {
    // Deduct from bank account if requested
    if (deductFromBank.value && selectedBankAccountId.value) {
      const bankAcc = sortedBankAccounts.value.find(a => a.id === selectedBankAccountId.value)
      if (bankAcc) {
        await bank.updateAccount(selectedBankAccountId.value, {
          balance: Number(bankAcc.balance) - grossAmount,
        })
      }
    }
    if (selectedAccountId.value) {
      await Promise.all([
        stocks.fetchAccount(selectedAccountId.value),
        fetchAccountTransactions(selectedAccountId.value),
      ])
    } else if (targetStockAccountId) {
      await stocks.fetchAccounts()
    }
    void reloadChartsAfterMutation(targetStockAccountId)
  }
}

async function handleCsvImport(transactions: StockTransactionBulkCreate[]): Promise<boolean> {
  if (!csvImportAccountId.value) return false

  const result = await stocks.bulkImportTransactions(csvImportAccountId.value, transactions)
  
  if (result) {
    showCsvImportModal.value = false
    await refreshAccountView(csvImportAccountId.value)
    stocks.fetchTransactions()
    void reloadChartsAfterMutation(csvImportAccountId.value)
    return true
  }
  return false
}

function openPlatformImport(accountId?: string): void {
  platformImportAccountId.value = accountId ?? stocks.accounts[0]?.id ?? ''
  showPlatformImportModal.value = true
}

async function handlePlatformImported(): Promise<void> {
  showPlatformImportModal.value = false
  if (platformImportAccountId.value) {
    await refreshAccountView(platformImportAccountId.value)
    stocks.fetchTransactions()
    void reloadChartsAfterMutation(platformImportAccountId.value)
  }
}

function openPhotoImport(accountId: string): void {
  photoImportAccountId.value = accountId
  showPhotoImportModal.value = true
}

async function handlePhotoImport(transactions: any[]): Promise<void> {
  if (!photoImportAccountId.value || transactions.length === 0) return

  const bulkItems: StockTransactionBulkCreate[] = transactions
    .filter(tx => tx.asset_key)
    .map(tx => ({
      asset_key: tx.asset_key,
      type: tx.type,
      amount: Number(tx.amount),
      price_per_unit: Number(tx.price_per_unit),
      fees: Number(tx.fees ?? 0),
      executed_at: tx.executed_at,
      notes: tx.notes ?? undefined,
    }))

  if (bulkItems.length === 0) return

  await stocks.bulkImportTransactions(photoImportAccountId.value, bulkItems)
  await refreshAccountView(photoImportAccountId.value)
  stocks.fetchTransactions()
  void reloadChartsAfterMutation(photoImportAccountId.value)
}

function openEditTransaction(tx: any): void {
  txFormError.value = null
  editingTxId.value = tx.id
  txForm.account_id = selectedAccountId.value!
  txForm.symbol = tx.symbol
  txForm.asset_key = tx.asset_key || ''
  txForm.exchange = tx.exchange
  txForm.type = tx.type
  txForm.amount = tx.amount
  txForm.price_per_unit = tx.price_per_unit
  txForm.fees = tx.fees
  txForm.executed_at = tx.executed_at.slice(0, 16)
  dividendMode.value = 'cash'
  
  // Populate positions for the modal
  modalPositions.value = selectedAccountSummary.value?.positions ?? []

  // Pre-fill unified asset field
  const sourcePool = (tx.type === 'SELL' || tx.type === 'DIVIDEND') ? ownedAssetOptions.value : knownAssetOptions.value
  const knownMatch = sourcePool.find(k =>
    (tx.asset_key && k.asset_key === tx.asset_key) || k.symbol === tx.symbol
  )
  assetQuery.value = knownMatch
    ? formatAssetOption(knownMatch)
    : tx.name || tx.symbol
  assetOptions.value = sourcePool
  assetError.value = null
  showExchange.value = !!tx.exchange
  showTxModal.value = true
}

async function handleSubmitTransaction(): Promise<void> {
  const dateErr = checkDateValid(txForm.executed_at)
  if (dateErr) {
    txFormError.value = dateErr
    return
  }

  if (!txForm.asset_key || txForm.asset_key.trim() === '') {
    txFormError.value = "L'ISIN est obligatoire."
    return
  }

  // Basic ISIN format check (2 letters + 9 alphanum + 1 digit/char check) - length 12
  if (txForm.asset_key.length !== 12) {
    txFormError.value = 'Format ISIN invalide (doit faire 12 caractères).'
    return
  }

  if (txForm.amount <= 0) {
    txFormError.value = 'La quantité doit être strictement positive.'
    return
  }
  if (txForm.price_per_unit < 0 || (txForm.fees !== undefined && txForm.fees < 0)) {
    txFormError.value = 'Le prix et les frais doivent être positifs ou nuls.'
    return
  }

  txFormError.value = null

  let result
  showTxModal.value = false
  if (isDividendShares.value) {
    // Shares dividend: stored as BUY at €0 — lowers PRU without cash outflow
    const payload: StockTransactionCreate = {
      account_id: txForm.account_id,
      asset_key: txForm.asset_key,
      symbol: txForm.symbol,
      name: txForm.name,
      exchange: txForm.exchange,
      type: 'BUY',
      amount: txForm.amount,
      price_per_unit: 0,
      fees: 0,
      executed_at: txForm.executed_at,
      notes: 'Dividende en actions',
    }
    result = editingTxId.value
      ? await stocks.updateTransaction(editingTxId.value, payload)
      : await stocks.createTransaction(payload)
  } else if (editingTxId.value) {
    result = await stocks.updateTransaction(editingTxId.value, { ...txForm })
  } else {
    result = await stocks.createTransaction({ ...txForm })
  }
  if (result) {
    if (selectedAccountId.value) {
      await Promise.all([
        stocks.fetchAccount(selectedAccountId.value),
        fetchAccountTransactions(selectedAccountId.value)
      ])
    }
    stocks.fetchTransactions()
    void reloadChartsAfterMutation(txForm.account_id)
  } else {
    showTxModal.value = true
  }
}

async function deleteTransaction(id: string): Promise<void> {
  const confirmed = await confirmDialog({
    title: 'Supprimer la transaction',
    message: 'Supprimer cette transaction ?',
    confirmLabel: 'Supprimer',
  })
  if (confirmed) {
    const wasDepositModal = !!editingDepositId.value
    showTxModal.value = false
    showDepositModal.value = false
    const success = await stocks.deleteTransaction(id)
    if (!success) {
      if (wasDepositModal) showDepositModal.value = true
      else showTxModal.value = true
      return
    }
    if (selectedAccountId.value) {
      await Promise.all([
        stocks.fetchAccount(selectedAccountId.value),
        fetchAccountTransactions(selectedAccountId.value)
      ])
    }
    stocks.fetchTransactions()
    void reloadChartsAfterMutation(selectedAccountId.value)
  }
}

async function fetchAccountTransactions(id: string): Promise<void> {
  accountTransactions.value = await stocks.fetchAccountTransactions(id)
}

/** Select (or re-select) an account and reload its data — never toggles. */
async function refreshAccountView(id: string): Promise<void> {
  selectedAccountId.value = id
  activeDetailTab.value = 'positions'
  // First load: fast cached data from DB
  await Promise.all([
    stocks.fetchAccount(id, true),
    fetchAccountTransactions(id),
    stocks.fetchHistoryForAccount(id),
  ])
  // Then refresh in background with live market data
  stocks.refreshAccount(id)
}

async function selectAccount(id: string): Promise<void> {
  if (selectedAccountId.value === id) {
    // Toggle: deselect
    selectedAccountId.value = null
    stocks.currentAccount = null
    return
  }
  await refreshAccountView(id)
}

function confirmDeleteAccount(account: { id: string; name: string }): void {
  deleteTarget.value = { type: 'account', id: account.id, label: account.name }
  showDeleteModal.value = true
}

async function handleDelete(): Promise<void> {
  if (!deleteTarget.value) return
  showDeleteModal.value = false

  if (deleteTarget.value.type === 'account') {
    const success = await stocks.deleteAccount(deleteTarget.value.id)
    if (!success) {
      showDeleteModal.value = true
      return
    }
    showAccountModal.value = false
    editingAccountId.value = null
    if (selectedAccountId.value === deleteTarget.value.id) {
      selectedAccountId.value = null
      stocks.currentAccount = null
    }
    void reloadChartsAfterMutation()
  } else {
    // Legacy delete path via confirmation modal, if used
    const success = await stocks.deleteTransaction(deleteTarget.value.id)
    if (!success) {
      showDeleteModal.value = true
      return
    }
    if (selectedAccountId.value) {
      await Promise.all([
        stocks.fetchAccount(selectedAccountId.value),
        fetchAccountTransactions(selectedAccountId.value)
      ])
    }
    void reloadChartsAfterMutation(selectedAccountId.value)
  }

  deleteTarget.value = null
}

const chartPerformance = ref<{ diff: number; percent: number } | null>(null)

function badgeVariant(type: string): 'primary' | 'info' | 'warning' {
  if (type === 'PEA') return 'primary'
  if (type === 'PEA_PME') return 'warning'
  return 'info'
}

function transactionDisplayedTotal(tx: TransactionResponse): number {
  if (tx.asset_key === 'EUR') {
    if (tx.type === 'DEPOSIT') return Number(tx.amount) - Number(tx.fees ?? 0)
    return Number(tx.amount)
  }

  const base = Number(tx.amount) * Number(tx.price_per_unit)
  const fees = Number(tx.fees ?? 0)

  if (tx.type === 'BUY') return base + fees
  if (tx.type === 'SELL' || tx.type === 'DIVIDEND') return base - fees

  return base
}

// ISIN-like detection: 2 letters + at least 3 alphanumeric, no spaces
const ISIN_LIKE_RE = /^[A-Za-z]{2}[A-Za-z0-9]{3,}$/

let assetSearchTimeout: ReturnType<typeof setTimeout> | null = null
async function handleAssetInput(value: string): Promise<void> {
  // Cancel any pending API search immediately, before any early return
  if (assetSearchTimeout) {
    clearTimeout(assetSearchTimeout)
    assetSearchTimeout = null
  }
  isAssetSearching.value = false

  assetQuery.value = value
  assetError.value = null

  const q = value.trim().toLowerCase()

  // For SELL and DIVIDEND, restrict to positions the user currently holds — no API search
  if (txForm.type === 'SELL' || txForm.type === 'DIVIDEND') {
    assetOptions.value = !q
      ? ownedAssetOptions.value
      : ownedAssetOptions.value.filter(a =>
          (a.symbol?.toLowerCase().includes(q) ?? false) ||
          (a.name?.toLowerCase().includes(q) ?? false) ||
          (a.asset_key?.toLowerCase().includes(q) ?? false)
        )
    return
  }

  // BUY: filter known/owned assets (client-side)
  // If the query is empty, show ONLY the owned assets of the selected account (limited to 10)
  if (!q) {
    assetOptions.value = ownedAssetOptions.value.slice(0, 10)
    return
  }

  const knownMatches: AssetOption[] = knownAssetOptions.value.filter(a =>
    (a.symbol?.toLowerCase().includes(q) ?? false) ||
    (a.name?.toLowerCase().includes(q) ?? false) ||
    (a.asset_key?.toLowerCase().includes(q) ?? false)
  )

  // Decide whether to also call the API:
  // - fewer than 3 known matches AND at least 2 chars typed
  // - OR the input looks like an ISIN (never in the known list by definition)
  const isIsinLike = ISIN_LIKE_RE.test(value) && !value.includes(' ')
  const needsApi = q.length >= 2 && (isIsinLike || knownMatches.length < 3)

  if (!needsApi) {
    assetOptions.value = knownMatches
    return
  }

  // Show known matches immediately, then append API results
  assetOptions.value = knownMatches

  if (assetSearchTimeout) clearTimeout(assetSearchTimeout)
  isAssetSearching.value = true

  assetSearchTimeout = setTimeout(async () => {
    try {
      if (document.activeElement?.id !== 'stock-tx-asset') return

      const apiRaw: AssetSearchResult[] = await stocks.searchAssets(value)
      // Deduplicate: skip API results already covered by known assets or EUR
      const apiExtra: AssetOption[] = apiRaw
        .filter(r => r.asset_key !== 'EUR' && r.symbol !== 'EUR')
        .filter(r => !knownMatches.some(k =>
          (r.asset_key && r.asset_key === k.asset_key) || r.symbol === k.symbol
        ))
        .map(r => ({ symbol: r.symbol, asset_key: r.asset_key ?? null, name: r.name, exchange: r.exchange, _source: 'api' as const }))
      
      if (document.activeElement?.id !== 'stock-tx-asset') return
      assetOptions.value = [...knownMatches, ...apiExtra]
    } catch {
      // keep current known matches on error
    } finally {
      isAssetSearching.value = false
    }
  }, 300)
}

// ── Lifecycle ────────────────────────────────────────────────
onMounted(async () => {
  // Independent of the account list — start immediately in parallel
  fetchRate()
  stocks.fetchTransactions()

  await stocks.fetchAccounts()

  // Charts load in the background — their sections have loading states,
  // so the account list renders without waiting for the histories.
  void loadStockChartHistories()
})
</script>

<template>
  <div>
    <PageHeader title="Bourse" description="PEA, PEA-PME et Comptes-Titres">
      <template #actions>
        <BaseButton size="sm" variant="outline" @click="openDeposit()" :disabled="!stocks.accounts.length">
          <Banknote class="w-4 h-4" /><span class="hidden sm:inline">&nbsp; Déposer</span>
        </BaseButton>
        <BaseButton size="sm" variant="outline" @click="openCsvImport()" :disabled="!stocks.accounts.length">
          <Upload class="w-4 h-4" /><span class="hidden sm:inline">&nbsp; Importer</span>
        </BaseButton>
        <BaseButton size="sm" variant="outline" @click="openPlatformImport()" :disabled="!stocks.accounts.length">
          <Upload class="w-4 h-4" /><span class="hidden sm:inline">&nbsp; Courtiers</span>
        </BaseButton>
        <BaseAddButton size="sm" @click="openCreateAccount">Nouveau compte</BaseAddButton>
      </template>
    </PageHeader>

    <!-- Loading -->
    <div v-if="stocks.isLoading && !stocks.accounts.length" class="flex justify-center py-20">
      <BaseSpinner size="lg" label="Chargement..." />
    </div>

    <!-- Error -->
    <BaseAlert v-if="stocks.error" variant="danger" dismissible @dismiss="stocks.error = null" class="mb-6">
      {{ stocks.error }}
    </BaseAlert>

    <BaseCard v-if="stocks.accounts.length" title="Analyse du portefeuille bourse" subtitle="Évolution, répartition et performance" class="mb-6">
      <!-- Nav row: slide label + arrows + inline performance -->
      <div class="mb-3 flex items-center justify-between gap-2">
        <!-- Left: slide label + prev/next -->
        <div class="flex items-center gap-1 min-w-0">
          <BaseButton icon size="sm" variant="ghost" class="shrink-0" @click="prevStockChartSlide">
            <ChevronLeft class="w-4 h-4" />
          </BaseButton>
          <p class="text-xs font-medium text-text-main dark:text-text-dark-main truncate">
            {{ stockChartSlideLabel }}
          </p>
          <BaseButton icon size="sm" variant="ghost" class="shrink-0" @click="nextStockChartSlide">
            <ChevronRight class="w-4 h-4" />
          </BaseButton>
        </div>

        <!-- Right: stats -->
        <div class="flex items-center gap-2 shrink-0">
          <div v-if="stockChartSlide === 'pnl'" class="flex items-center gap-2 shrink-0 cursor-pointer" @click="showMobilePnlLabels = !showMobilePnlLabels">
            <span :class="['text-[11px] text-text-muted dark:text-text-dark-muted transition-all duration-200', showMobilePnlLabels ? 'inline' : 'hidden sm:inline']">Moy.</span>
            <span :class="['text-xs font-semibold', profitLossClass(stockDailyPnlAverage)]">
              {{ formatCurrency(stockDailyPnlAverage) }}
            </span>
            <span :class="['text-text-muted dark:text-text-dark-muted text-[10px]', showMobilePnlLabels ? 'inline' : 'hidden sm:inline']">•</span>
            <span :class="['text-[11px] text-text-muted dark:text-text-dark-muted transition-all duration-200', showMobilePnlLabels ? 'inline' : 'hidden sm:inline']">Auj.</span>
            <span :class="['text-xs font-semibold', profitLossClass(stockLatestPortfolioDailyPnl)]">
              {{ formatCurrency(stockLatestPortfolioDailyPnl) }}
            </span>
          </div>
          
          <ChartPerformanceBadge
            v-else-if="(stockChartSlide === 'evolution' || stockChartSlide === 'cumulative_pnl')"
            :performance="chartPerformance"
          />
        </div>
      </div>

      <div
        class="min-h-[340px]"
        @touchstart.passive="stockChartSwipe.onTouchStart"
        @touchend.passive="stockChartSwipe.onTouchEnd"
      >
        <div v-if="stocks.historyLoading" class="h-72 flex items-center justify-center">
          <BaseSpinner size="md" label="Chargement de l'historique..." />
        </div>

      <template v-else-if="stockChartSlide === 'evolution'">
        <template v-if="stockChartSeries.length > 0">
          <HistoryLineChart
            :series="stockChartSeries"
            :is-dark="isDark"
            :granularity="historyGranularity"
            show-performance
            @update:performance="chartPerformance = $event"
          >
            <template #leading>
              <BaseButton icon size="sm" variant="outline" @click="loadStockChartHistories(true)">
                <RefreshCw class="w-4 h-4" />
              </BaseButton>
              <BaseSegmentedControl v-model="historyGranularity" :options="granularityOptions" variant="primary" size="sm" />
            </template>
          </HistoryLineChart>
        </template>
        <BaseEmptyState
          v-else
          title="Pas encore de données historiques"
          description="L'évolution s'affichera dès que des snapshots sont disponibles"
        />
      </template>

      <template v-else-if="stockChartSlide === 'allocation'">
        <template v-if="allocationSegments.length">
          <AllocationDonutChart :segments="allocationSegments" :is-dark="isDark" reserve-top-space />
        </template>
        <BaseEmptyState
          v-else
          title="Pas de répartition disponible"
          description="Ajoutez des comptes bourse pour visualiser l'allocation globale"
        />
      </template>

      <template v-else-if="stockChartSlide === 'pnl'">
        <template v-if="stockDailyPnlSeries.length > 0">
          <HistoryLineChart
            :series="stockDailyPnlSeries"
            :is-dark="isDark"
            granularity="daily"
          >
            <template #leading>
              <BaseButton icon size="sm" variant="outline" @click="loadStockChartHistories(true)">
                <RefreshCw class="w-4 h-4" />
              </BaseButton>
              <BaseSegmentedControl v-model="historyGranularity" :options="granularityOptions" variant="primary" size="sm" />
            </template>
          </HistoryLineChart>
        </template>
        <BaseEmptyState
          v-else
          title="Pas de P/L journalier disponible"
          description="Le graphique apparaitra des que des donnees quotidiennes seront disponibles"
        />
      </template>

      <template v-else-if="stockChartSlide === 'cumulative_pnl'">
        <template v-if="stockAllTimePnlSeries.length > 0">
          <HistoryLineChart
            :series="stockAllTimePnlSeries"
            :is-dark="isDark"
            :granularity="historyGranularity"
            show-performance
            @update:performance="chartPerformance = $event"
          >
            <template #leading>
              <BaseButton icon size="sm" variant="outline" @click="loadStockChartHistories(true)">
                <RefreshCw class="w-4 h-4" />
              </BaseButton>
              <BaseSegmentedControl v-model="historyGranularity" :options="granularityOptions" variant="primary" size="sm" />
            </template>
          </HistoryLineChart>
        </template>
        <BaseEmptyState
          v-else
          title="Pas de P/L cumulé disponible"
          description="Le graphique apparaitra des que des donnees quotidiennes seront disponibles"
        />
      </template>
      </div>
    </BaseCard>

    <!-- ── Filter tabs ──────────────────────────────────── -->
    <div v-if="stocks.accounts.length" class="mb-6 border-b border-surface-border dark:border-surface-dark-border">
      <div class="flex gap-6">
        <button
          v-for="tab in [
            { key: 'all' as const, label: 'Tous' },
            { key: 'PEA' as const, label: 'PEA' },
            { key: 'CTO' as const, label: 'CTO' },
            { key: 'PEA_PME' as const, label: 'PEA-PME' },
          ]"
          :key="tab.key"
          @click="activeFilter = tab.key"
          :class="[
            'pb-3 text-sm font-medium transition-all duration-150 border-b-2',
            activeFilter === tab.key
              ? 'border-primary text-primary'
              : 'border-transparent text-text-muted dark:text-text-dark-muted hover:text-text-main dark:hover:text-text-dark-main hover:border-surface-border dark:hover:border-surface-dark-border',
          ]"
        >
          {{ tab.label }}
        </button>
      </div>
    </div>

    <!-- ── Account list ─────────────────────────────────── -->
    <div v-if="filteredAccounts.length" class="space-y-4">
      <BaseCard
        v-for="account in filteredAccounts"
        :key="account.id"
        :class="[
          'transition-all duration-150',
          selectedAccountId === account.id ? 'ring-2 ring-primary ring-offset-2 dark:ring-offset-background-dark' : '',
        ]"
      >
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div
            class="flex-1 cursor-pointer min-w-0"
            @click="selectAccount(account.id)"
          >
            <div class="flex items-center gap-3">
              <h3 class="font-semibold text-text-main dark:text-text-dark-main truncate">{{ account.name }}</h3>
              <BaseBadge :variant="badgeVariant(account.account_type)">
                {{ accountTypeLabels[account.account_type] || account.account_type }}
              </BaseBadge>
            </div>
            <div class="flex items-center gap-3 mt-1">
              <span v-if="account.institution_name" class="text-xs text-text-muted dark:text-text-dark-muted">{{ account.institution_name }}</span>
              <span class="text-xs text-text-muted dark:text-text-dark-muted">Créé le {{ formatDate(account.created_at) }}</span>
            </div>
          </div>
          <div class="flex items-center gap-2 shrink-0 self-start">
              <BaseAddButton variant="ghost" size="sm" @click.stop="openAddTransaction(account.id)">Transaction</BaseAddButton>
            <BaseButton size="sm" variant="ghost" @click.stop="openEditAccount(account)">
              <Pencil class="w-4 h-4" />
            </BaseButton>
          </div>
        </div>

        <!-- Inline account detail when selected -->
        <div
          v-if="selectedAccountId === account.id && selectedAccountSummary"
          class="mt-6 pt-6 border-t border-surface-border dark:border-surface-dark-border"
        >
          <!-- Account summary stats -->
          <div class="mb-6 space-y-3">
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div
                v-for="stat in activeStockSummaryStats"
                :key="stat.key"
                class="rounded-secondary bg-background-subtle dark:bg-background-dark-subtle border border-surface-border dark:border-surface-dark-border p-3.5"
              >
                <p class="text-[11px] font-medium uppercase tracking-wider text-text-muted dark:text-text-dark-muted mb-1">{{ stat.label }}</p>
                <p :class="['text-lg font-bold tabular-nums', stat.valueClass ?? 'text-text-main dark:text-text-dark-main']">
                  {{ stat.value }}
                </p>
              </div>
            </div>

            <div v-if="stockSummaryStatPages.length > 1" class="flex items-center justify-center gap-2">
              <button
                v-for="(_, index) in stockSummaryStatPages"
                :key="`stock-summary-dot-${index}`"
                type="button"
                :aria-label="`Afficher le groupe de statistiques ${index + 1}`"
                class="h-2.5 w-2.5 rounded-full transition-colors"
                :class="index === stockSummaryStatsPage ? 'bg-primary' : 'bg-surface-active dark:bg-surface-dark-active hover:bg-primary/40'"
                @click="stockSummaryStatsPage = index"
              />
            </div>
          </div>

          <!-- Tabs -->
          <div class="mb-4">
            <BaseSegmentedControl v-model="activeDetailTab" :options="[{ key: 'positions', label: 'Positions' }, { key: 'history', label: 'Historique' }]" variant="surface" size="md" />
          </div>

          <!-- Currency display toggle (only when account has non-EUR positions) -->
          <div v-if="canToggleCurrency && activeDetailTab === 'positions'" class="mb-5 flex items-center gap-2">
            <span class="text-xs text-text-muted dark:text-text-dark-muted">Affichage cours :</span>
            <BaseSegmentedControl v-model="displayCurrency" :options="[{ key: 'EUR', label: '€ EUR' }, { key: 'USD', label: '$ Devise native' }]" variant="surface" size="sm" />
            <span v-if="displayCurrency === 'USD'" class="text-xs text-info italic">
              P/L calculé en €
            </span>
          </div>

          <!-- Positions table -->
          <div v-if="activeDetailTab === 'positions'">
            <div v-if="sortedPositions.length" class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="text-left text-xs text-text-muted dark:text-text-dark-muted uppercase tracking-wider border-b border-surface-border dark:border-surface-dark-border">
                    <th class="px-4 py-2">Nom</th>
                    <th class="px-4 py-2 text-right">Quantité</th>
                    <th class="px-4 py-2 text-right">PRU</th>
                    <th class="px-4 py-2 text-right">Investi (€)</th>
                    <th class="px-4 py-2 text-right">Cours</th>
                    <th class="px-4 py-2 text-right">Valeur</th>
                    <th class="px-4 py-2 text-right">P/L (€)</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-surface-border dark:divide-surface-dark-border">
                  <tr
                    v-for="pos in sortedPositions"
                    :key="`${pos.asset_key ?? pos.symbol}-${pos.exchange || 'NONE'}`"
                    class="hover:bg-surface-hover dark:hover:bg-surface-dark-hover transition-colors"
                  >
                    <td class="px-4 py-2.5">
                      <span class="font-medium text-text-main dark:text-text-dark-main">{{ pos.name || (pos.asset_key ?? pos.symbol) }}</span>
                      <span v-if="pos.exchange" class="ml-1 text-xs text-text-muted dark:text-text-dark-muted">({{ pos.exchange }})</span>
                    </td>
                    <td class="px-4 py-2.5 text-right text-text-body dark:text-text-dark-body">{{ formatNumber(pos.total_amount, 4) }}</td>
                    <td class="px-4 py-2.5 text-right text-text-body dark:text-text-dark-body">{{ formatPru(pos.average_buy_price, pos.currency) }}</td>
                    <td class="px-4 py-2.5 text-right text-text-body dark:text-text-dark-body">{{ maskValue(formatCurrency(pos.total_invested)) }}</td>
                    <td class="px-4 py-2.5 text-right text-text-body dark:text-text-dark-body">{{ formatPosPrice(pos.current_price, pos.currency) }}</td>
                    <td class="px-4 py-2.5 text-right font-medium text-text-main dark:text-text-dark-main">{{ maskValue(formatPosPrice(pos.current_value, pos.currency)) }}</td>
                    <td class="px-4 py-2.5 text-right">
                      <span :class="['font-medium', profitLossClass(posProfitLossEur(pos))]">
                        {{ maskValue(formatCurrency(posProfitLossEur(pos))) }}
                      </span>
                      <span :class="['block text-xs', profitLossClass(posProfitLossPctEur(pos))]">
                        {{ formatPercent(posProfitLossPctEur(pos)) }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-else class="py-6 text-center">
              <p class="text-sm text-text-muted dark:text-text-dark-muted">Aucune position — ajoutez des transactions pour commencer</p>
            </div>
          </div>

          <!-- History Tab -->
          <div v-else>
            <div v-if="sortedTransactions.length" class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="text-left text-xs text-text-muted dark:text-text-dark-muted uppercase tracking-wider border-b border-surface-border dark:border-surface-dark-border">
                    <th class="px-4 py-2">Date</th>
                    <th class="px-4 py-2">Type</th>
                    <th class="px-4 py-2">ISIN</th>
                    <th class="px-4 py-2 text-right">Quantité</th>
                    <th class="px-4 py-2 text-right">Prix</th>
                    <th class="px-4 py-2 text-right">Total</th>
                    <th class="px-4 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-surface-border dark:divide-surface-dark-border">
                  <tr v-for="tx in sortedTransactions" :key="tx.id"
                    :class="['transition-colors', tx.asset_key === 'EUR' ? 'bg-info/5 dark:bg-info/10' : 'hover:bg-surface-hover dark:hover:bg-surface-dark-hover']">
                    <td class="px-4 py-2.5 text-text-muted dark:text-text-dark-muted">{{ new Date(tx.executed_at).toLocaleDateString() }}</td>
                    <td class="px-4 py-2.5">
                      <BaseBadge :variant="tx.asset_key === 'EUR' ? 'info' : (tx.type === 'BUY' || tx.type === 'DEPOSIT' ? 'success' : tx.type === 'SELL' ? 'danger' : 'info')">
                        {{ tx.type }}
                      </BaseBadge>
                    </td>
                    <td class="px-4 py-2.5 text-text-muted dark:text-text-dark-muted text-xs">{{ tx.asset_key === 'EUR' ? '—' : (tx.asset_key || '-') }}</td>
                    <td class="px-4 py-2.5 text-right font-mono">{{ tx.asset_key === 'EUR' ? '—' : formatNumber(tx.amount, 4) }}</td>
                    <td class="px-4 py-2.5 text-right">{{ tx.asset_key === 'EUR' ? '—' : formatCurrency(tx.price_per_unit) }}</td>
                    <td class="px-4 py-2.5 text-right font-medium">{{ maskValue(formatCurrency(transactionDisplayedTotal(tx))) }}</td>
                    <td class="px-4 py-2.5 text-right">
                      <BaseButton v-if="tx.asset_key !== 'EUR'" size="sm" variant="ghost" @click="openEditTransaction(tx)">
                        <Pencil class="w-4 h-4" />
                      </BaseButton>
                      <BaseButton v-else-if="tx.type === 'DEPOSIT'" size="sm" variant="ghost" @click="openEditDeposit(tx)">
                        <Pencil class="w-4 h-4" />
                      </BaseButton>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <BaseEmptyState v-else title="Aucune transaction" description="L'historique des transactions est vide" />
          </div>
        </div>

        <!-- Loading spinner for account detail -->
        <div
          v-if="selectedAccountId === account.id && stocks.isLoading && !selectedAccountSummary"
          class="mt-6 pt-6 border-t border-surface-border dark:border-surface-dark-border flex justify-center py-8"
        >
          <BaseSpinner size="md" label="Chargement des positions..." />
        </div>
      </BaseCard>
    </div>

    <!-- Empty state -->
    <BaseEmptyState
      v-else-if="!stocks.isLoading && !stocks.accounts.length"
      title="Aucun compte bourse"
      description="Créez un PEA, un Compte-Titres ou un PEA-PME pour suivre vos investissements en bourse"
      action-label="Créer un compte"
      @action="openCreateAccount"
    >
      <template #icon>
        <TrendingUp class="w-8 h-8 text-text-muted dark:text-text-dark-muted" />
      </template>
    </BaseEmptyState>

    <!-- No results for filter -->
    <BaseEmptyState
      v-else-if="!stocks.isLoading && stocks.accounts.length && !filteredAccounts.length"
      title="Aucun compte de ce type"
      :description="`Aucun compte ${activeFilter === 'PEA_PME' ? 'PEA-PME' : activeFilter} trouvé`"
    >
      <template #action>
        <BaseButton size="sm" variant="outline" @click="activeFilter = 'all'">Voir tous les comptes</BaseButton>
      </template>
    </BaseEmptyState>

    <!-- ── Create Account Modal ─────────────────────────── -->
    <BaseModal :open="showAccountModal" :title="editingAccountId ? 'Modifier le compte' : 'Nouveau compte bourse'" @close="showAccountModal = false">
      <BaseAlert v-if="accountFormError" variant="danger" dismissible class="mb-4" @dismiss="accountFormError = null">
        {{ accountFormError }}
      </BaseAlert>
      <form @submit.prevent="handleSubmitAccount" class="space-y-4">
        <BaseSelect
          v-model="accountForm.account_type"
          label="Type de compte"
          :options="availableAccountTypes"
          required
        />

        <BaseInput
          v-model="accountForm.name"
          label="Nom du compte"
          placeholder="Nom du compte"
          required
        />
        <BaseInput v-model="accountForm.institution_name!" label="Courtier / Banque" placeholder="Nom du courtier" />
        <BaseInput v-model="accountForm.identifier!" label="Identifiant" placeholder="Numéro de compte" />
        <BaseInput v-model="accountForm.opened_at!" label="Date d'ouverture" type="date" />
      </form>
      <template #footer>
        <div class="flex justify-between w-full">
          <BaseButton v-if="editingAccountId" variant="danger" @click="confirmDeleteAccount({ id: editingAccountId, name: accountForm.name })">
            Supprimer
          </BaseButton>
          <div v-else></div> <!-- Spacer -->
          <div class="flex gap-2">
            <BaseButton variant="ghost" @click="showAccountModal = false">Annuler</BaseButton>
            <BaseButton :loading="stocks.isLoading" @click="handleSubmitAccount">
              {{ editingAccountId ? 'Enregistrer' : 'Créer' }}
            </BaseButton>
          </div>
        </div>
      </template>
    </BaseModal>

    <!-- ── Create/Edit Transaction Modal ─────────────────────── -->
    <BaseModal :open="showTxModal" :title="editingTxId ? 'Modifier la transaction' : 'Nouvelle transaction'" @close="showTxModal = false">
      <BaseAlert v-if="txFormError" variant="danger" dismissible class="mb-4" @dismiss="txFormError = null">
        {{ txFormError }}
      </BaseAlert>
      <form @submit.prevent="handleSubmitTransaction" class="space-y-4">

        <!-- Type first so the asset picker scope adapts immediately -->
        <BaseSelect v-model="txForm.type" label="Type de transaction" :options="txTypeOptions" required />

        <!-- ── Dividend mode toggle ── -->
        <template v-if="txForm.type === 'DIVIDEND'">
          <div class="inline-flex w-full bg-background-subtle dark:bg-background-dark-subtle rounded-lg p-1">
            <button
              type="button"
              @click="dividendMode = 'cash'"
              :class="[
                'flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200',
                dividendMode === 'cash'
                  ? 'bg-surface dark:bg-surface-dark text-text-main dark:text-text-dark-main shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                  : 'text-text-muted dark:text-text-dark-muted hover:text-text-main dark:hover:text-text-dark-main',
              ]"
            >Versement en espèces</button>
            <button
              type="button"
              @click="dividendMode = 'shares'"
              :class="[
                'flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200',
                dividendMode === 'shares'
                  ? 'bg-surface dark:bg-surface-dark text-text-main dark:text-text-dark-main shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                  : 'text-text-muted dark:text-text-dark-muted hover:text-text-main dark:hover:text-text-dark-main',
              ]"
            >En actions (DRIP)</button>
          </div>
          <p v-if="isDividendShares" class="text-xs text-text-muted dark:text-text-dark-muted -mt-2">
            Les actions reçues sont enregistrées comme un achat à 0 € — réduit le PRU moyen sans sortie de cash
          </p>
        </template>

        <!-- ── Unified asset picker ── -->
        <div>
          <BaseAutocomplete
            id="stock-tx-asset"
            :model-value="assetQuery"
            @update:model-value="handleAssetInput"
            @select="handleSelectUnifiedAsset"
            label="Actif"
            :placeholder="(txForm.type === 'SELL' || txForm.type === 'DIVIDEND') ? 'Choisir parmi vos positions…' : 'Nom, symbole ou ISIN…'"
            :options="assetOptions"
            :display-value="formatAssetOption"
            :loading="isAssetSearching"
            :show-all-on-focus="true"
            remote
          >
            <template #item="{ item }">
              <div class="flex items-center justify-between gap-2 w-full">
                <div class="min-w-0 flex items-baseline gap-1.5 truncate">
                  <span class="font-medium text-text-main dark:text-text-dark-main">
                    {{ item.name || item.symbol }}
                  </span>
                  <span v-if="item.name && item.asset_key" class="text-text-muted dark:text-text-dark-muted text-xs">
                    ({{ item.asset_key }})
                  </span>
                  <span v-else-if="item.name && item.symbol" class="text-text-muted dark:text-text-dark-muted text-xs">
                    ({{ item.symbol }})
                  </span>
                </div>  
                <span
                  :class="[
                    'text-xs shrink-0 px-1.5 py-0.5 rounded-secondary font-medium',
                    item._source === 'known'
                      ? 'bg-primary-light text-primary'
                      : 'bg-background-subtle dark:bg-background-dark-subtle text-text-muted dark:text-text-dark-muted',
                  ]"
                >{{ item._source === 'known' ? 'portefeuille' : 'marché' }}</span>
              </div>
            </template>
          </BaseAutocomplete>
          <p v-if="assetError" class="text-xs text-danger mt-1">{{ assetError }}</p>
          <p v-else-if="txForm.type === 'SELL' || txForm.type === 'DIVIDEND'" class="text-xs text-text-muted dark:text-text-dark-muted mt-1">
            Seules vos positions actuelles sont proposées
          </p>
          <p v-else class="text-xs text-text-muted dark:text-text-dark-muted mt-1">
            Tapez un nom, un symbole ou un ISIN — les actifs de votre portefeuille apparaissent en premier
          </p>
        </div>

        <!-- Symbole + ISIN pré-remplis (confirmation / correction) -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <BaseInput
            v-model="txForm.symbol"
            label="Symbole"
            placeholder="Ex : AAPL, MC.PA…"
            required
          />
          <BaseInput
            v-model="txForm.asset_key!"
            label="ISIN"
            placeholder="Obligatoire"
            required
          />
        </div>

        <!-- Place de marché optionnelle -->
        <div v-if="showExchange">
          <BaseInput
            v-model="txForm.exchange!"
            label="Place de marché"
            placeholder="Ex : XPAR, XNAS…"
          />
        </div>
        <button
          v-if="!showExchange"
          type="button"
          class="text-xs text-primary hover:underline -mt-2 block"
          @click="showExchange = true"
        >
          + Ajouter une place de marché
        </button>

        <div :class="isDividendShares ? '' : 'grid grid-cols-1 sm:grid-cols-2 gap-4'">
          <div>
            <BaseInput v-model="txForm.amount" :label="txAmountLabel" type="number" step="any" min="0" required />
            <p v-if="txForm.type === 'SELL' && sellMaxAmount !== null" class="text-xs text-text-muted dark:text-text-dark-muted mt-1">
              Disponible : {{ formatNumber(sellMaxAmount, 4) }} action{{ sellMaxAmount !== 1 ? 's' : '' }}
            </p>
          </div>
          <BaseInput
            v-if="!isDividendShares"
            v-model="txForm.price_per_unit"
            :label="txPriceLabel"
            type="number" step="any" min="0"
            required
          />
        </div>
        <BaseInput v-if="!isDividendShares" v-model="txForm.fees!" label="Frais (€)" type="number" step="any" min="0" placeholder="0.00" />
        <BaseInput v-model="txForm.executed_at" label="Date d'exécution" type="datetime-local" required />
      </form>
      <template #footer>
        <div class="flex justify-between w-full">
          <BaseButton v-if="editingTxId" variant="danger" @click="deleteTransaction(editingTxId)">
            Supprimer
          </BaseButton>
          <div v-else>
            <BaseButton
              variant="ghost"
              size="sm"
              @click="openPhotoImport(txForm.account_id); showTxModal = false"
            >
              <Camera class="w-4 h-4 sm:mr-1.5" />
              <span class="hidden sm:inline">Depuis une photo</span>
            </BaseButton>
          </div>
          <div class="flex gap-2">
            <BaseButton variant="ghost" @click="showTxModal = false">Annuler</BaseButton>
            <BaseButton :loading="stocks.isLoading" @click="handleSubmitTransaction">
              {{ editingTxId ? 'Enregistrer' : 'Valider' }}
            </BaseButton>
          </div>
        </div>
      </template>
    </BaseModal>

    <!-- ── Delete Confirmation Modal ────────────────────── -->
    <BaseModal :open="showDeleteModal" title="Confirmer la suppression" size="sm" @close="showDeleteModal = false">
      <p class="text-sm text-text-body dark:text-text-dark-body">
        Supprimer le compte <strong class="text-text-main dark:text-text-dark-main">{{ deleteTarget?.label }}</strong> et toutes ses transactions ? Cette action est irréversible.
      </p>
      <template #footer>
        <BaseButton variant="ghost" @click="showDeleteModal = false">Annuler</BaseButton>
        <BaseButton variant="danger" :loading="stocks.isLoading" @click="handleDelete">Supprimer</BaseButton>
      </template>
    </BaseModal>

    <!-- ── CSV Import Modal ────────────────────────────── -->
    <CsvImportModal
      :open="showCsvImportModal"
      :account-id="csvImportAccountId || ''"
      asset-type="stocks"
      :accounts="stocks.accounts"
      :on-import="handleCsvImport"
      @update:account-id="id => csvImportAccountId = id"
      @close="showCsvImportModal = false"
    />

    <!-- ── Platform Import Modal (unified, brokers) ────── -->
    <PlatformImportModal
      :open="showPlatformImportModal"
      category="stock"
      :accounts="stocks.accounts"
      v-model:accountId="platformImportAccountId"
      @close="showPlatformImportModal = false"
      @imported="handlePlatformImported"
    />

    <!-- ── Photo Import Modal ─────────────────────────── -->
    <PhotoImportModal
      :open="showPhotoImportModal"
      asset-type="stock"
      :account-id="photoImportAccountId || ''"
      @confirm="handlePhotoImport"
      @close="showPhotoImportModal = false"
    />

    <!-- ── EUR Deposit Modal ──────────────────────────── -->
    <BaseModal :open="showDepositModal" :title="editingDepositId ? 'Modifier le dépôt' : 'Déposer des euros'" @close="showDepositModal = false">
      <BaseAlert v-if="depositFormError" variant="danger" dismissible class="mb-4" @dismiss="depositFormError = null">
        {{ depositFormError }}
      </BaseAlert>
      <form @submit.prevent="handleSubmitDeposit" class="space-y-4">
        <!-- Stock account selector (only for new deposits) -->
        <div v-if="!editingDepositId">
          <label class="block text-xs font-medium text-text-muted dark:text-text-dark-muted mb-1">Compte de bourse</label>
          <select
            v-model="depositStockAccountId"
            class="w-full px-3 py-2 text-sm rounded-input border border-surface-border dark:border-surface-dark-border bg-surface dark:bg-surface-dark text-text-main dark:text-text-dark-main focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            required
          >
            <option v-for="acc in stocks.accounts" :key="acc.id" :value="acc.id">
              {{ acc.name }} — {{ acc.account_type }}
            </option>
          </select>
        </div>
        <BaseInput
          v-model="depositForm.amount"
          label="Montant (€)"
          type="number"
          step="any"
          min="0.01"
          placeholder="0.00"
          required
        />
        <BaseInput
          v-model="depositForm.fees"
          label="Frais (€)"
          type="number"
          step="any"
          min="0"
          placeholder="0.00"
        />
        <p class="text-xs text-text-muted dark:text-text-dark-muted -mt-2">
          Montant crédité en bourse : montant - frais.
        </p>
        <BaseInput
          v-model="depositForm.executed_at"
          label="Date du dépôt"
          type="datetime-local"
          required
        />
        <BaseInput
          v-model="depositForm.notes!"
          label="Notes"
          placeholder="Optionnel"
        />

        <!-- Bank deduction option (only for new deposits) -->
        <div v-if="!editingDepositId" class="rounded-card border border-surface-border dark:border-surface-dark-border p-4 space-y-3">
          <label class="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              v-model="deductFromBank"
              class="h-4 w-4 rounded accent-primary"
            />
            <span class="text-sm font-medium text-text-main dark:text-text-dark-main">
              Déduire de mon compte bancaire
            </span>
          </label>

          <div v-if="deductFromBank && sortedBankAccounts.length" class="space-y-2">
            <label class="block text-xs text-text-muted dark:text-text-dark-muted">Compte source</label>
            <select
              v-model="selectedBankAccountId"
              class="w-full px-3 py-2 text-sm rounded-input border border-surface-border dark:border-surface-dark-border bg-surface dark:bg-surface-dark text-text-main dark:text-text-dark-main focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              <option
                v-for="acc in sortedBankAccounts"
                :key="acc.id"
                :value="acc.id"
              >
                {{ acc.name }} — {{ formatCurrency(acc.balance) }}
              </option>
            </select>
          </div>

          <p v-if="deductFromBank && !sortedBankAccounts.length" class="text-xs text-text-muted dark:text-text-dark-muted">
            Aucun compte bancaire configuré.
          </p>
        </div>
      </form>
      <template #footer>
        <div class="flex justify-between w-full">
          <BaseButton v-if="editingDepositId" variant="danger" @click="deleteTransaction(editingDepositId)">
            Supprimer
          </BaseButton>
          <div v-else></div>
          <div class="flex gap-2">
            <BaseButton variant="ghost" @click="showDepositModal = false">Annuler</BaseButton>
            <BaseButton :loading="stocks.isLoading || bank.isLoading" @click="handleSubmitDeposit">{{ editingDepositId ? 'Enregistrer' : 'Valider le dépôt' }}</BaseButton>
          </div>
        </div>
      </template>
    </BaseModal>
  </div>
</template>