<script setup lang="ts">
import { CreditCard, DollarSign, Eye, EyeOff, RefreshCw, TrendingUp, WalletCards } from 'lucide-vue-next'

import { onMounted, computed, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useDashboardStore } from '@/stores/dashboard'
import { useWealthHistoryStore } from '@/stores/wealthHistory'
import { useSettingsStore } from '@/stores/settings'
import { useFormatters } from '@/composables/useFormatters'
import { usePrivacyMode } from '@/composables/usePrivacyMode'
import { useDarkMode } from '@/composables/useDarkMode'
import PageHeader from '@/components/PageHeader.vue'
import { BaseCard, BaseAlert, BaseButton, BaseEmptyState, BaseSegmentedControl, BaseStatCard, BaseSkeleton, NetWorthHistoryChart } from '@/components'
import HistoryLineChart from '@/components/charts/HistoryLineChart.vue'
import AllocationDonutChart from '@/components/charts/AllocationDonutChart.vue'
import InvestmentComparisonBarChart from '@/components/charts/InvestmentComparisonBarChart.vue'
import type {
  AccountHistorySnapshotResponse,
  GlobalHistorySnapshotResponse,
  ProjectionCategory,
  ProjectionDataPoint,
} from '@/types'

const auth = useAuthStore()
const dashboard = useDashboardStore()
const historyStore = useWealthHistoryStore()
const settingsStore = useSettingsStore()
const { formatCurrency, formatPercent, profitLossClass } = useFormatters()
const { privacyMode, togglePrivacyMode, maskValue } = usePrivacyMode()
const { isDark } = useDarkMode()

const bankEnabled = computed(() => settingsStore.settings?.bank_module_enabled ?? true)
const cashflowEnabled = computed(() => settingsStore.settings?.cashflow_module_enabled ?? true)
const wealthEnabled = computed(() => settingsStore.settings?.wealth_module_enabled ?? true)

// KPI card count = 2 fixed + optional bank + optional cashflow
const kpiCount = computed(() => 2 + (bankEnabled.value ? 1 : 0) + (cashflowEnabled.value ? 1 : 0))
const kpiColsClass = computed(() => {
  switch (kpiCount.value) {
    case 2: return 'grid-cols-1 sm:grid-cols-2'
    case 3: return 'grid-cols-1 sm:grid-cols-3'
    default: return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
  }
})

const breakdownSlides = [
  {
    key: 'distribution',
    title: 'Répartition des investissements',
    subtitle: 'Bourse vs Crypto',
  },
  {
    key: 'wealth',
    title: 'Composition du patrimoine',
    subtitle: 'Cash, investissements et biens',
  },
] as const

const activeBreakdownSlide = ref(0)
const activeBreakdown = computed(() => breakdownSlides[activeBreakdownSlide.value] ?? breakdownSlides[0])

function nextBreakdownSlide(): void {
  activeBreakdownSlide.value = (activeBreakdownSlide.value + 1) % breakdownSlides.length
}

function prevBreakdownSlide(): void {
  activeBreakdownSlide.value = (activeBreakdownSlide.value - 1 + breakdownSlides.length) % breakdownSlides.length
}

const projectionSlides = [
  {
    key: 'stock',
    title: 'Projection actions (10 ans)',
    subtitle: 'Valeur projetee des actions',
  },
  {
    key: 'crypto',
    title: 'Projection crypto (10 ans)',
    subtitle: 'Valeur projetee du portefeuille crypto',
  },
  {
    key: 'total',
    title: 'Projection globale (10 ans)',
    subtitle: 'Patrimoine total projete',
  },
] as const

const activeProjectionSlide = ref(0)
const activeProjection = computed(() => projectionSlides[activeProjectionSlide.value] ?? projectionSlides[0])

function nextProjectionSlide(): void {
  activeProjectionSlide.value = (activeProjectionSlide.value + 1) % projectionSlides.length
}

function prevProjectionSlide(): void {
  activeProjectionSlide.value = (activeProjectionSlide.value - 1 + projectionSlides.length) % projectionSlides.length
}

type HistoryGranularity = 'daily' | 'weekly' | 'monthly' | 'yearly'
const historyGranularity = ref<HistoryGranularity>('daily')

const allGranularityOptions: Array<{ value: HistoryGranularity; label: string }> = [
  { value: 'daily', label: 'Jour' },
  { value: 'weekly', label: 'Semaine' },
  { value: 'monthly', label: 'Mois' },
  { value: 'yearly', label: 'Année' },
]

function getHistorySpanDays(history: GlobalHistorySnapshotResponse[]): number {
  if (history.length < 2) return 0
  const first = new Date(history[0]!.snapshot_date).getTime()
  const last = new Date(history[history.length - 1]!.snapshot_date).getTime()
  if (!Number.isFinite(first) || !Number.isFinite(last) || last <= first) return 0
  return Math.floor((last - first) / 86400000)
}

const granularityOptions = computed(() => {
  const sortedHistory = [...(historyStore.history ?? [])].sort(
    (a, b) => new Date(a.snapshot_date).getTime() - new Date(b.snapshot_date).getTime(),
  )
  const spanDays = getHistorySpanDays(sortedHistory)
  return allGranularityOptions.filter((option) => {
    if (option.value === 'daily') return true
    if (option.value === 'weekly') return spanDays >= 21
    if (option.value === 'monthly') return spanDays >= 90
    if (option.value === 'yearly') return spanDays >= 365
    return true
  })
})


interface ProjectionValuePoint {
  snapshot_date: string
  projected_stock_value: number
  projected_crypto_value: number
  projected_total_value: number
}

interface PieSegment {
  name: string
  value: number
}

watch(granularityOptions, (options) => {
  const allowed = options.map((option) => option.value)
  if (!allowed.includes(historyGranularity.value)) {
    historyGranularity.value = options[0]?.value ?? 'daily'
  }
}, { immediate: true })

function getIsoWeekKey(snapshotDate: string): string {
  const date = new Date(snapshotDate)
  if (Number.isNaN(date.getTime())) return snapshotDate

  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const weekday = utcDate.getUTCDay() || 7
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - weekday)

  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1))
  const weekNumber = Math.ceil((((utcDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${utcDate.getUTCFullYear()}-W${String(weekNumber).padStart(2, '0')}`
}

function getHistoryBucketKey(snapshotDate: string, granularity: HistoryGranularity): string {
  const date = new Date(snapshotDate)
  if (Number.isNaN(date.getTime())) return snapshotDate

  if (granularity === 'weekly') return getIsoWeekKey(snapshotDate)
  if (granularity === 'monthly') return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  if (granularity === 'yearly') return String(date.getFullYear())
  return snapshotDate
}

function getProjectedAssetValue(point: ProjectionDataPoint, category: ProjectionCategory): number {
  const dynamicValue = point.asset_values?.[category]
  if (dynamicValue != null) {
    return Number(dynamicValue)
  }

  return 0
}

const wealthCompositionSegments = computed<PieSegment[]>(() => {
  const wealth = dashboard.statistics?.wealth
  if (!wealth) return []

  const segments: PieSegment[] = []

  if (bankEnabled.value) {
    segments.push({ name: 'Cash', value: Number(wealth.cash ?? 0) })
  }

  segments.push({ name: 'Investissements', value: Number(wealth.investments ?? 0) })

  if (wealthEnabled.value) {
    segments.push({ name: 'Patrimoine matériel', value: Number(wealth.assets ?? 0) })
  }

  return segments
})

const hasWealthCompositionData = computed(() => {
  return wealthCompositionSegments.value.some((segment) => segment.value > 0)
})

const projectedValueHistory = computed<ProjectionValuePoint[]>(() => {
  const projectionData = dashboard.projection?.data ?? []

  return projectionData.map((point) => ({
    snapshot_date: point.date,
    projected_stock_value: getProjectedAssetValue(point, 'STOCK'),
    projected_crypto_value: getProjectedAssetValue(point, 'CRYPTO'),
    projected_total_value: Number(point.total_value),
  }))
})

const chartProjectedValueHistory = computed<ProjectionValuePoint[]>(() => {
  const history = projectedValueHistory.value
  if (!history.length || historyGranularity.value === 'daily') return history

  const byBucket = new Map<string, ProjectionValuePoint>()
  for (const snapshot of history) {
    const bucketKey = getHistoryBucketKey(snapshot.snapshot_date, historyGranularity.value)
    byBucket.set(bucketKey, snapshot)
  }

  return Array.from(byBucket.values())
})

function buildProjectionSnapshot(snapshotDate: string, value: number): AccountHistorySnapshotResponse {
  return {
    snapshot_date: snapshotDate,
    total_value: value,
    total_invested: 0,
    total_deposits: 0,
    total_withdrawals: 0,
    daily_pnl: null,
    cumulative_pnl: value,
    total_fees: null,
    total_dividends: null,
    positions: null,
  }
}

const projectedValueSeries = computed<Array<{ name: string; history: AccountHistorySnapshotResponse[] }>>(() => {
  const history = chartProjectedValueHistory.value

  return [
    {
      name: 'Valeur actions projetee',
      history: history.map((snapshot) => buildProjectionSnapshot(snapshot.snapshot_date, snapshot.projected_stock_value)),
    },
    {
      name: 'Valeur crypto projetee',
      history: history.map((snapshot) => buildProjectionSnapshot(snapshot.snapshot_date, snapshot.projected_crypto_value)),
    },
    {
      name: 'Patrimoine total projete',
      history: history.map((snapshot) => buildProjectionSnapshot(snapshot.snapshot_date, snapshot.projected_total_value)),
    },
  ]
})

const activeProjectedValueSeries = computed<Array<{ name: string; history: AccountHistorySnapshotResponse[] }>>(() => {
  const selectedSeries = projectedValueSeries.value[activeProjectionSlide.value]
  return selectedSeries ? [selectedSeries] : []
})

const chartHistory = computed<GlobalHistorySnapshotResponse[]>(() => {
  const history = historyStore.history
  if (!history || historyGranularity.value === 'daily') return history ?? []

  // Keep the latest point of each period (end-of-week/month/year value).
  const byBucket = new Map<string, GlobalHistorySnapshotResponse>()
  for (const snapshot of history) {
    const bucketKey = getHistoryBucketKey(snapshot.snapshot_date, historyGranularity.value)
    byBucket.set(bucketKey, snapshot)
  }

  return Array.from(byBucket.values())
})

onMounted(() => {
  if (auth.isAuthenticated) {
    dashboard.fetchAll(settingsStore.settings)
    historyStore.fetchHistory()
    dashboard.fetchProjection({ months_to_project: 120 })
  }
})
</script>

<template>
  <div>
    <PageHeader
      title="Dashboard"
      :description="`Bienvenue ${auth.user?.username ?? ''} — Vue d'ensemble de votre patrimoine`"
    >
      <template #actions>
        <button
          @click="togglePrivacyMode"
          :title="privacyMode ? 'Afficher les valeurs' : 'Masquer les valeurs'"
          class="w-9 h-9 flex items-center justify-center rounded-button border border-surface-border dark:border-surface-dark-border bg-surface dark:bg-surface-dark text-text-muted dark:text-text-dark-muted hover:text-primary dark:hover:text-primary transition-colors"
        >
          <!-- Eye icon (visible) -->
          <Eye v-if="!privacyMode" class="w-5 h-5" />
          <!-- Eye-off icon (hidden) -->
          <EyeOff v-else class="w-5 h-5" />
        </button>
      </template>
    </PageHeader>

    <!-- Error -->
    <BaseAlert v-if="dashboard.error" variant="danger" dismissible @dismiss="dashboard.error = null" class="mb-6">
      {{ dashboard.error }}
    </BaseAlert>

    <div class="space-y-8">
      <!-- ── Summary KPI Cards ──────────────────────────── -->
      <div :class="['grid gap-4', kpiColsClass]">
        <!-- Skeleton KPI cards -->
        <template v-if="dashboard.isLoading">
          <div v-for="i in kpiCount" :key="i" class="rounded-card bg-surface dark:bg-surface-dark border border-surface-border dark:border-surface-dark-border p-5 shadow-soft">
            <div class="flex items-start justify-between">
              <div class="flex-1 space-y-3">
                <BaseSkeleton variant="rect" width="60%" height="0.75rem" />
                <BaseSkeleton variant="rect" width="80%" height="1.5rem" />
              </div>
              <BaseSkeleton variant="circle" width="2.5rem" />
            </div>
          </div>
        </template>

        <!-- Real KPI cards -->
        <template v-else>
          <BaseStatCard
            v-if="bankEnabled"
            label="Solde bancaire"
            :value="maskValue(formatCurrency(dashboard.bankAccounts?.total_balance))"
          >
            <template #icon>
              <div class="w-10 h-10 rounded-primary bg-info/10 flex items-center justify-center">
                <CreditCard class="w-5 h-5 text-info" />
              </div>
            </template>
          </BaseStatCard>

          <BaseStatCard
            label="Portfolio investi"
            :value="maskValue(formatCurrency(dashboard.portfolio?.total_invested))"
          >
            <template #icon>
              <div class="w-10 h-10 rounded-primary bg-primary/10 flex items-center justify-center">
                <TrendingUp class="w-5 h-5 text-primary" />
              </div>
            </template>
          </BaseStatCard>

          <BaseStatCard
            label="Valeur actuelle"
            :value="maskValue(formatCurrency(dashboard.portfolio?.current_value))"
            :sub-value="formatPercent(dashboard.portfolio?.profit_loss_percentage)"
            :sub-value-class="profitLossClass(dashboard.portfolio?.profit_loss_percentage)"
          >
            <template #icon>
              <div class="w-10 h-10 rounded-primary bg-success/10 flex items-center justify-center">
                <DollarSign class="w-5 h-5 text-success" />
              </div>
            </template>
          </BaseStatCard>

          <BaseStatCard
            v-if="cashflowEnabled"
            label="Épargne mensuelle"
            :value="maskValue(formatCurrency(dashboard.cashflowBalance?.monthly_balance))"
            :sub-value="dashboard.cashflowBalance?.savings_rate != null ? `Taux ${formatPercent(dashboard.cashflowBalance.savings_rate)}` : undefined"
            sub-value-class="text-text-muted dark:text-text-dark-muted"
          >
            <template #icon>
              <div class="w-10 h-10 rounded-primary bg-warning/10 flex items-center justify-center">
                <WalletCards class="w-5 h-5 text-warning" />
              </div>
            </template>
          </BaseStatCard>
        </template>
      </div>

      <!-- ── Statistics: Distribution & Wealth ───────────────── -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BaseCard v-if="dashboard.isLoading || dashboard.statistics" class="h-full" body-class="flex min-h-0 flex-1 flex-col">
          <template #header>
            <div class="flex items-start justify-between gap-3">
              <div>
                <h3 class="text-lg font-semibold text-text-main dark:text-text-dark-main">{{ activeBreakdown.title }}</h3>
                <p class="text-sm text-text-muted dark:text-text-dark-muted mt-0.5">{{ activeBreakdown.subtitle }}</p>
              </div>
              <div class="inline-flex items-center gap-1 rounded-button border border-surface-border dark:border-surface-dark-border bg-background-subtle dark:bg-background-dark-subtle p-1">
                <button
                  type="button"
                  class="h-7 w-7 rounded-button text-text-main dark:text-text-dark-main hover:bg-surface dark:hover:bg-surface-dark"
                  aria-label="Vue precedente"
                  @click="prevBreakdownSlide"
                >
                  &#8249;
                </button>
                <button
                  type="button"
                  class="h-7 w-7 rounded-button text-text-main dark:text-text-dark-main hover:bg-surface dark:hover:bg-surface-dark"
                  aria-label="Vue suivante"
                  @click="nextBreakdownSlide"
                >
                  &#8250;
                </button>
              </div>
            </div>
          </template>

          <!-- Skeleton -->
          <div v-if="dashboard.isLoading" class="space-y-4">
            <div v-for="i in 3" :key="i" class="flex items-center justify-between p-4 rounded-secondary border border-surface-border dark:border-surface-dark-border">
              <div class="space-y-2 flex-1">
                <BaseSkeleton variant="rect" width="40%" height="0.75rem" />
                <BaseSkeleton variant="rect" width="60%" height="1.25rem" />
              </div>
              <BaseSkeleton variant="rect" width="3rem" height="1.5rem" />
            </div>
          </div>

          <!-- Data -->
          <div v-else-if="dashboard.statistics" class="flex min-h-0 flex-1 flex-col">
            <div class="space-y-4">
            <template v-if="activeBreakdown.key === 'distribution'">
              <InvestmentComparisonBarChart
                :stock-invested="Number(dashboard.statistics.distribution.stock_invested ?? 0)"
                :stock-current-value="Number(dashboard.statistics.distribution.stock_current_value ?? 0)"
                :crypto-invested="Number(dashboard.statistics.distribution.crypto_invested ?? 0)"
                :crypto-current-value="Number(dashboard.statistics.distribution.crypto_current_value ?? 0)"
                :is-dark="isDark"
              />
            </template>

            <template v-else>
              <AllocationDonutChart
                v-if="hasWealthCompositionData"
                :segments="wealthCompositionSegments"
                :is-dark="isDark"
              />
              <BaseEmptyState
                v-else
                title="Aucune donnée de composition"
                description="Ajoutez des comptes ou des biens pour visualiser la composition du patrimoine"
              />
            </template>
            </div>

            <!-- Carousel Pagination -->
            <div class="mt-auto flex justify-center gap-1.5 pt-4">
              <button
                v-for="(slide, index) in breakdownSlides"
                :key="slide.key"
                type="button"
                class="h-2 rounded-full transition-all"
                :class="index === activeBreakdownSlide
                  ? 'w-6 bg-primary'
                  : 'w-2 bg-surface-border dark:bg-surface-dark-border hover:bg-text-muted dark:hover:bg-text-dark-muted'"
                :aria-label="`Afficher ${slide.title}`"
                @click="activeBreakdownSlide = index"
              />
            </div>
          </div>
        </BaseCard>

        <BaseCard class="h-full" body-class="flex min-h-0 flex-1 flex-col">
          <template #header>
            <div class="flex items-start justify-between gap-3">
              <div>
                <h3 class="text-lg font-semibold text-text-main dark:text-text-dark-main">{{ activeProjection.title }}</h3>
                <p class="text-sm text-text-muted dark:text-text-dark-muted mt-0.5">{{ activeProjection.subtitle }}</p>
              </div>
              <div class="inline-flex items-center gap-1 rounded-button border border-surface-border dark:border-surface-dark-border bg-background-subtle dark:bg-background-dark-subtle p-1">
                <button
                  type="button"
                  class="h-7 w-7 rounded-button text-text-main dark:text-text-dark-main hover:bg-surface dark:hover:bg-surface-dark"
                  aria-label="Vue precedente"
                  @click="prevProjectionSlide"
                >
                  &#8249;
                </button>
                <button
                  type="button"
                  class="h-7 w-7 rounded-button text-text-main dark:text-text-dark-main hover:bg-surface dark:hover:bg-surface-dark"
                  aria-label="Vue suivante"
                  @click="nextProjectionSlide"
                >
                  &#8250;
                </button>
              </div>
            </div>
          </template>

          <div class="flex min-h-0 flex-1 flex-col">
            <div class="flex-1">
              <div v-if="dashboard.projectionLoading" class="h-72 flex items-center justify-center">
                <BaseSkeleton variant="rect" width="100%" height="18rem" />
              </div>
              <BaseAlert v-else-if="dashboard.projectionError" variant="danger">
                {{ dashboard.projectionError }}
              </BaseAlert>
              <HistoryLineChart
                v-else-if="chartProjectedValueHistory.length > 0"
                :series="activeProjectedValueSeries"
                :is-dark="isDark"
                granularity="yearly"
                hide-controls
              />
              <BaseEmptyState
                v-else
                title="Estimation impossible"
                description="L'estimation à long terme donne un total perdant, ou il manque des données d'investissement"
              />
            </div>

            <!-- Carousel Pagination -->
            <div class="mt-auto flex justify-center gap-1.5 pt-4">
              <button
                v-for="(slide, index) in projectionSlides"
                :key="slide.key"
                type="button"
                class="h-2 rounded-full transition-all"
                :class="index === activeProjectionSlide
                  ? 'w-6 bg-primary'
                  : 'w-2 bg-surface-border dark:bg-surface-dark-border hover:bg-text-muted dark:hover:bg-text-dark-muted'"
                :aria-label="`Afficher ${slide.title}`"
                @click="activeProjectionSlide = index"
              />
            </div>
          </div>
        </BaseCard>
      </div>

      <!-- ── Wealth History Chart ───────────────────────── -->
      <BaseCard v-if="historyStore.isLoading || historyStore.error || (historyStore.history && historyStore.history.length > 0)" title="Évolution du patrimoine" subtitle="Historique journalier de la valeur globale">
        <div v-if="historyStore.isLoading" class="h-72 flex items-center justify-center">
          <BaseSkeleton variant="rect" width="100%" height="18rem" />
        </div>
        <BaseAlert v-else-if="historyStore.error" variant="danger">
          {{ historyStore.error }}
        </BaseAlert>
        <template v-else-if="historyStore.hasMeaningfulHistory">
          <div class="mb-4 flex justify-end">
            <div class="flex items-center gap-2">
              <BaseButton size="sm" variant="outline" @click="historyStore.fetchHistory()">
                <RefreshCw class="w-4 h-4" />
              </BaseButton>
              <BaseSegmentedControl v-model="historyGranularity" :options="granularityOptions" variant="primary" size="sm" />
            </div>
          </div>
          <NetWorthHistoryChart
            :history="chartHistory"
            :is-dark="isDark"
            :bank-enabled="bankEnabled"
            :wealth-enabled="wealthEnabled"
            :granularity="historyGranularity"
          />
        </template>
        <BaseEmptyState
          v-else
          title="Pas encore assez de données"
          description="L'historique s'affichera après 7 jours de suivi quotidien"
        />
      </BaseCard>

    </div>
  </div>
</template>
