<script setup lang="ts">
/**
 * The desktop layout: a review. The net worth beside the month in progress,
 * the curve beside the figures behind it, then every investment and account in
 * exact numbers — nothing folded into a carousel.
 */
import { computed } from 'vue'
import { BaseCard } from '@/components'
import AiInsightCard from '@/components/AiInsightCard.vue'
import RealCashflowPace from '@/components/cashflow/RealCashflowPace.vue'
import AccountsList from '@/components/dashboard/AccountsList.vue'
import AttentionStrip from '@/components/dashboard/AttentionStrip.vue'
import DashboardTile from '@/components/dashboard/DashboardTile.vue'
import InvestmentsTable from '@/components/dashboard/InvestmentsTable.vue'
import NetWorthHero from '@/components/dashboard/NetWorthHero.vue'
import WealthHistoryCard from '@/components/dashboard/WealthHistoryCard.vue'
import { useDarkMode } from '@/composables/useDarkMode'
import { useDashboardTiles } from '@/composables/useDashboardTiles'
import type { DashboardOverview } from '@/composables/useDashboardOverview'
import { useSettingsStore } from '@/stores/settings'

const props = defineProps<{ overview: DashboardOverview }>()

const settingsStore = useSettingsStore()
const { isDark } = useDarkMode()
// The month has its own card here, with its curve: no tile repeats it.
const { portfolio, cash, savings } = useDashboardTiles(props.overview)
const tiles = computed(() => [portfolio.value, cash.value, savings.value].filter((tile) => tile !== null))

const placementsValue = computed(() => props.overview.investmentRows.find((row) => row.key === 'placements')?.value ?? null)
const hasAccounts = computed(
  () => props.overview.bankAccounts.length > 0 || (props.overview.portfolio?.accounts.length ?? 0) > 0 || !!placementsValue.value,
)
const showMonth = computed(() => props.overview.bankEnabled && props.overview.month !== null)
</script>

<template>
  <div class="grid grid-cols-12 gap-6">
    <!-- The row takes the month card's height: the hero fills it rather than
         leaving a blank band under its legend. -->
    <BaseCard :class="showMonth ? 'col-span-7 xl:col-span-8' : 'col-span-12'" body-class="flex flex-1 flex-col">
      <NetWorthHero
        :total="overview.total"
        :changes="overview.changes"
        :composition="overview.composition"
        :cash-uncounted="overview.cashUncounted"
        :prices-live="overview.pricesLive"
        :loading="overview.isLoading"
        layout="desktop"
      />
    </BaseCard>

    <BaseCard v-if="showMonth && overview.month" class="col-span-5 xl:col-span-4">
      <template #header>
        <h3 class="text-base font-semibold text-text-main dark:text-text-dark-main">Mois en cours</h3>
      </template>
      <RealCashflowPace :data="overview.month" :is-dark="isDark" stacked compact />
    </BaseCard>

    <AttentionStrip v-if="overview.attention.length" class="col-span-12" :items="overview.attention" />

    <div class="col-span-8 min-w-0">
      <WealthHistoryCard
        :history="overview.history"
        :loading="overview.historyLoading"
        :error="overview.historyError"
        :meaningful="overview.hasMeaningfulHistory"
        :bank-enabled="overview.bankEnabled"
        :wealth-enabled="overview.wealthEnabled"
        granularity-control
      />
    </div>

    <!-- The tiles share the curve's height, so the column ends where the card does. -->
    <div class="col-span-4 flex flex-col gap-4">
      <template v-if="overview.isLoading && !tiles.length">
        <DashboardTile v-for="i in 3" :key="i" class="flex-1" label="" value="" loading />
      </template>
      <DashboardTile
        v-for="tile in tiles"
        v-else
        :key="tile.key"
        class="flex-1"
        :label="tile.label"
        :value="tile.value"
        :detail="tile.detail"
        :detail-class="tile.detailClass"
        :note="tile.note"
        :to="tile.to"
      />
      <AiInsightCard v-if="settingsStore.settings?.ai_feature_enabled" />
    </div>

    <BaseCard v-if="overview.investmentRows.length" :class="hasAccounts ? 'col-span-7' : 'col-span-12'">
      <template #header>
        <h3 class="text-base font-semibold text-text-main dark:text-text-dark-main">Investissements</h3>
      </template>
      <InvestmentsTable :rows="overview.investmentRows" />
    </BaseCard>

    <BaseCard v-if="hasAccounts" :class="overview.investmentRows.length ? 'col-span-5' : 'col-span-12'">
      <template #header>
        <h3 class="text-base font-semibold text-text-main dark:text-text-dark-main">Comptes</h3>
      </template>
      <AccountsList
        :bank-accounts="overview.bankAccounts"
        :investment-accounts="overview.portfolio?.accounts ?? []"
        :placements-value="placementsValue"
      />
    </BaseCard>
  </div>
</template>
