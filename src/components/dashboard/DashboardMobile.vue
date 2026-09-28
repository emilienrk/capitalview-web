<script setup lang="ts">
/**
 * The phone layout: a glance. The net worth and what needs doing come first,
 * four figures after, then the curve; the account detail waits behind a tap.
 */
import { computed } from 'vue'
import { ChevronDown } from 'lucide-vue-next'
import AiInsightCard from '@/components/AiInsightCard.vue'
import AccountsList from '@/components/dashboard/AccountsList.vue'
import AttentionStrip from '@/components/dashboard/AttentionStrip.vue'
import DashboardTile from '@/components/dashboard/DashboardTile.vue'
import NetWorthHero from '@/components/dashboard/NetWorthHero.vue'
import WealthHistoryCard from '@/components/dashboard/WealthHistoryCard.vue'
import { useDashboardTiles } from '@/composables/useDashboardTiles'
import type { DashboardOverview } from '@/composables/useDashboardOverview'
import { useSettingsStore } from '@/stores/settings'

const props = defineProps<{ overview: DashboardOverview }>()

const settingsStore = useSettingsStore()
const { portfolio, cash, month, savings } = useDashboardTiles(props.overview)
const tiles = computed(() => [portfolio.value, cash.value, month.value, savings.value].filter((tile) => tile !== null))

const placementsValue = computed(() => props.overview.investmentRows.find((row) => row.key === 'placements')?.value ?? null)
const hasAccounts = computed(
  () => props.overview.bankAccounts.length > 0 || (props.overview.portfolio?.accounts.length ?? 0) > 0 || !!placementsValue.value,
)
</script>

<template>
  <div class="space-y-6">
    <NetWorthHero
      :total="overview.total"
      :changes="overview.changes"
      :composition="overview.composition"
      :cash-uncounted="overview.cashUncounted"
      :prices-live="overview.pricesLive"
      :loading="overview.isLoading"
      layout="mobile"
    />

    <AttentionStrip :items="overview.attention" />

    <div v-if="overview.isLoading && !tiles.length" class="grid grid-cols-2 gap-3">
      <DashboardTile v-for="i in 4" :key="i" label="" value="" loading />
    </div>
    <div v-else-if="tiles.length" class="grid grid-cols-2 gap-3">
      <DashboardTile
        v-for="tile in tiles"
        :key="tile.key"
        :label="tile.label"
        :value="tile.value"
        :detail="tile.detail"
        :detail-class="tile.detailClass"
        :note="tile.note"
        :to="tile.to"
      />
    </div>

    <WealthHistoryCard
      :history="overview.history"
      :loading="overview.historyLoading"
      :error="overview.historyError"
      :meaningful="overview.hasMeaningfulHistory"
      :bank-enabled="overview.bankEnabled"
      :wealth-enabled="overview.wealthEnabled"
    />

    <details
      v-if="hasAccounts"
      class="group rounded-card border border-surface-border bg-surface shadow-soft dark:border-surface-dark-border dark:bg-surface-dark"
    >
      <summary class="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-base font-semibold text-text-main dark:text-text-dark-main [&::-webkit-details-marker]:hidden">
        Tous les comptes
        <ChevronDown class="h-4 w-4 text-text-muted transition-transform group-open:rotate-180 dark:text-text-dark-muted" aria-hidden="true" />
      </summary>
      <div class="border-t border-surface-border px-4 pb-4 pt-3 dark:border-surface-dark-border">
        <AccountsList
          :bank-accounts="overview.bankAccounts"
          :investment-accounts="overview.portfolio?.accounts ?? []"
          :placements-value="placementsValue"
        />
      </div>
    </details>

    <AiInsightCard v-if="settingsStore.settings?.ai_feature_enabled" />
  </div>
</template>
