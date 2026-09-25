<script setup lang="ts">
/**
 * The Banque section's Comptes tab: the total, its curve and the account cards.
 * The header, the sync, the imports and the account form belong to the section
 * shell (BankSection.vue), which also fetches the accounts.
 */
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'
import { computed, onMounted, ref, watch } from 'vue'

import { useCarousel } from '@/composables/useCarousel'
import { useBankStore } from '@/stores/bank'
import { useHistoryGranularity } from '@/composables/useHistoryGranularity'
import { useBankSection } from '@/composables/useBankSection'
import { useFormatters } from '@/composables/useFormatters'
import { usePrivacyMode } from '@/composables/usePrivacyMode'
import { useDarkMode } from '@/composables/useDarkMode'
import {
  BaseCard, BaseButton, BaseAlert, BaseEmptyState, BaseSkeleton, BaseSegmentedControl,
  ChartPerformanceBadge,
} from '@/components'
import HistoryLineChart from '@/components/charts/HistoryLineChart.vue'
import BankAccountCard from '@/components/bank/BankAccountCard.vue'

const bank = useBankStore()
const { openCreateAccount, openEditAccount } = useBankSection()
const { formatCurrency } = useFormatters()
const { maskValue } = usePrivacyMode()
const { isDark } = useDarkMode()

const {
  granularity: historyGranularity,
  granularityOptions,
  applyGranularity,
} = useHistoryGranularity(() => bank.history ?? [])

// The total on its own, then the accounts that make it up. Together on one
// chart the total dwarfs each account and nothing is readable; and the total is
// the figure that answers "combien j'ai", so it gets a slide to itself.
type BankChartSlide = 'total' | 'accounts'
const chartSlides: Array<{ key: BankChartSlide; label: string }> = [
  { key: 'total', label: 'Total du cash' },
  { key: 'accounts', label: 'Par compte' },
]
const {
  current: chartSlide,
  currentLabel: chartSlideLabel,
  next: nextChartSlide,
  prev: prevChartSlide,
  swipeHandlers: chartSwipe,
} = useCarousel(chartSlides)

const totalSeries = computed(() => {
  const history = applyGranularity(bank.history)
  return history.length ? [{ name: 'Solde total', history }] : []
})

const accountSeries = computed(() =>
  (bank.summary?.accounts ?? [])
    .map((account) => ({
      name: account.name,
      history: applyGranularity(bank.accountHistoryById[account.id] ?? []),
    }))
    .filter((series) => series.history.length > 0),
)

const chartSeries = computed(() =>
  chartSlide.value === 'total' ? totalSeries.value : accountSeries.value,
)

async function loadChartHistories(force = false): Promise<void> {
  // The interest rides along: it is read off the same balance history.
  void bank.fetchInterest()
  await bank.fetchHistory(force)
  const accounts = bank.summary?.accounts ?? []
  await Promise.all(accounts.map((account) => bank.fetchHistoryForAccount(account.id, force)))
}

// The shell fetches the accounts, possibly after this tab has mounted, and a
// sync, an import or an account written from the shell invalidates the caches:
// either way the curves are loaded again. Both land in the same tick after a
// write, and are answered by a single reload.
watch(
  [() => (bank.summary?.accounts ?? []).map((account) => account.id).join(','), () => bank.dataRevision],
  () => void loadChartHistories(),
)

// Chart histories load in the background (the chart has a skeleton state)
onMounted(() => void loadChartHistories())

const chartPerformance = ref<{ diff: number; percent: number | null } | null>(null)
</script>

<template>
  <div>
    <!-- Total balance -->
    <div v-if="bank.summary" class="mb-6 p-4 rounded-card bg-primary/5 border border-primary/10">
      <p class="text-sm text-text-muted dark:text-text-dark-muted">Solde total</p>
      <p class="text-3xl font-bold text-text-main dark:text-text-dark-main">
        {{ maskValue(formatCurrency(bank.summary.total_balance)) }}
      </p>
      <!-- No total rather than a wrong one: a currency held has no published rate. -->
      <p v-if="bank.summary.total_balance === null" class="mt-1 text-xs text-warning">
        Total indisponible : le cours d'une de vos devises n'est pas publié.
      </p>
    </div>

    <!-- Bank History Chart -->
    <BaseCard v-if="bank.summary?.accounts?.length" class="mb-6">
      <template #header>
        <div class="flex items-start sm:items-center justify-between gap-3">
          <h3 class="text-lg font-semibold text-text-main dark:text-text-dark-main">Évolution du solde</h3>
          <ChartPerformanceBadge :performance="chartPerformance" />
        </div>
        <div class="mt-3 flex items-center gap-1 min-w-0">
          <BaseButton icon size="sm" variant="ghost" class="shrink-0" @click="prevChartSlide">
            <ChevronLeft class="w-4 h-4" />
          </BaseButton>
          <p class="text-xs font-medium text-text-main dark:text-text-dark-main truncate">
            {{ chartSlideLabel }}
          </p>
          <BaseButton icon size="sm" variant="ghost" class="shrink-0" @click="nextChartSlide">
            <ChevronRight class="w-4 h-4" />
          </BaseButton>
        </div>
      </template>
      <div v-if="bank.historyLoading" class="h-72 flex items-center justify-center">
        <BaseSkeleton variant="rect" width="100%" height="18rem" />
      </div>
      <BaseAlert v-else-if="bank.error" variant="danger" class="mb-4">
        {{ bank.error }}
      </BaseAlert>
      <template v-else-if="chartSeries.length > 0">
        <div v-on="chartSwipe">
        <HistoryLineChart
          :series="chartSeries"
          :is-dark="isDark"
          :granularity="historyGranularity"
          show-performance
          @update:performance="chartPerformance = $event"
        >
          <template #leading>
            <BaseSegmentedControl v-model="historyGranularity" :options="granularityOptions" variant="primary" size="sm" />
          </template>
        </HistoryLineChart>
        </div>
      </template>
      <BaseEmptyState
        v-else
        title="Pas encore de données historiques"
        description="L'historique s'affichera après avoir importé ou créé des entrées de solde"
      />
    </BaseCard>

    <!-- Account list -->
    <div v-if="bank.summary?.accounts?.length" class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <BankAccountCard
        v-for="account in bank.summary.accounts"
        :key="account.id"
        :account="account"
        @edit="openEditAccount"
      />
    </div>

    <BaseEmptyState
      v-else-if="bank.summary && !bank.isLoading"
      title="Aucun compte"
      description="Ajoutez votre premier compte bancaire pour commencer le suivi"
      action-label="Ajouter un compte"
      @action="openCreateAccount"
    />
  </div>
</template>
