<script setup lang="ts">
/**
 * The landing's picture of the product: the real dashboard charts, fed with
 * made-up figures. Loaded async so the charting library stays off the first paint.
 */
import { computed } from 'vue'
import AllocationDonutChart from '@/components/charts/AllocationDonutChart.vue'
import NetWorthHistoryChart from '@/components/charts/NetWorthHistoryChart.vue'
import { useDarkMode } from '@/composables/useDarkMode'
import { useFormatters } from '@/composables/useFormatters'
import type { GlobalHistorySnapshotResponse } from '@/types'

const { isDark } = useDarkMode()
const { formatCurrency, formatPercent } = useFormatters()

// Twelve month-ends of an ordinary household: savings creep up, the stock
// market mostly helps, crypto ends the year lower.
const bank = [18200, 18650, 17900, 19100, 19400, 18800, 19750, 20100, 19600, 20400, 20900, 21350]
const stock = [24100, 24800, 25600, 25200, 26400, 27100, 26300, 27800, 28600, 29100, 28700, 29900]
const crypto = [6200, 7100, 6400, 5800, 6900, 7600, 6100, 5400, 5900, 6600, 6300, 5750]
const placements = [15000, 15050, 15100, 16150, 16200, 16260, 16310, 16370, 17420, 17480, 17530, 17590]
const assets = [12000, 12000, 11900, 11900, 11900, 11800, 11800, 11800, 11700, 11700, 11700, 11600]

// Dated relative to today, so the chart's "1 an" range always frames them.
const history = computed<GlobalHistorySnapshotResponse[]>(() => {
  const now = new Date()
  return bank.map((_, i) => {
    const day = new Date(Date.UTC(now.getFullYear(), now.getMonth() - (bank.length - 1 - i), 1))
    return {
      snapshot_date: day.toISOString().slice(0, 10),
      bank_value: bank[i]!,
      stock_value: stock[i]!,
      crypto_value: crypto[i]!,
      placements_value: placements[i]!,
      assets_value: assets[i]!,
      total_wealth: bank[i]! + stock[i]! + crypto[i]! + placements[i]! + assets[i]!,
    }
  })
})

const first = computed(() => history.value[0]!)
const last = computed(() => history.value[history.value.length - 1]!)
const change = computed(() => last.value.total_wealth - first.value.total_wealth)
const changePercent = computed(() => change.value / first.value.total_wealth * 100)

const segments = computed(() => [
  { name: 'Cash', value: last.value.bank_value },
  { name: 'Investissements', value: last.value.stock_value + last.value.crypto_value + last.value.placements_value },
  { name: 'Patrimoine matériel', value: last.value.assets_value },
])
</script>

<template>
  <figure class="border border-surface-border dark:border-surface-dark-border rounded-card bg-surface dark:bg-surface-dark">
    <figcaption class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 sm:px-7 py-4 border-b border-surface-border dark:border-surface-dark-border">
      <span class="font-semibold text-text-main dark:text-text-dark-main">Tableau de bord</span>
      <span class="text-sm text-text-muted dark:text-text-dark-muted">Exemple, chiffres fictifs</span>
    </figcaption>

    <div class="grid lg:grid-cols-3">
      <div class="lg:col-span-2 px-5 sm:px-7 py-6 lg:border-r border-surface-border dark:border-surface-dark-border min-w-0">
        <p class="text-sm text-text-muted dark:text-text-dark-muted">Patrimoine total</p>
        <p class="cv-figure mt-1 text-4xl sm:text-5xl font-semibold text-text-main dark:text-text-dark-main">
          {{ formatCurrency(last.total_wealth) }}
        </p>
        <p class="mt-2 text-sm">
          <span class="font-semibold text-text-main dark:text-text-dark-main">+{{ formatCurrency(change) }}</span>
          ({{ formatPercent(changePercent) }}) sur 12 mois
        </p>
        <div class="mt-6">
          <NetWorthHistoryChart :history="history" :is-dark="isDark" bank-enabled wealth-enabled granularity="monthly" />
        </div>
      </div>
      <div class="px-5 sm:px-7 py-6 border-t lg:border-t-0 border-surface-border dark:border-surface-dark-border min-w-0">
        <p class="text-sm text-text-muted dark:text-text-dark-muted">Répartition</p>
        <AllocationDonutChart :segments="segments" :is-dark="isDark" />
      </div>
    </div>
  </figure>
</template>
