<script setup lang="ts">
/**
 * One category of recurring payments or income — what the user filed them as —
 * over its whole history: the running ones and the ended ones together, so a
 * rent reads as one cost across the leases that carried it.
 */
import { computed } from 'vue'

import { BaseBadge, BaseModal, BaseStatCard } from '@/components'
import RecurringMonthsChart from '@/components/charts/RecurringMonthsChart.vue'
import { useFormatters } from '@/composables/useFormatters'
import { usePrivacyMode } from '@/composables/usePrivacyMode'
import { isCurrent, isInTotal } from '@/utils/recurring'
import type { BankRecurringItem } from '@/types'

const props = defineProps<{
  open: boolean
  title: string
  /** Counted ones of the category, running or ended. */
  items: BankRecurringItem[]
  currency: string
  income: boolean
}>()

defineEmits<{ close: [] }>()

const { formatCurrency, formatDate } = useFormatters()
const { maskValue } = usePrivacyMode()

// The chart's colours as the series' order: the oldest first, whatever runs now.
const ordered = computed(() =>
  [...props.items].sort((a, b) => a.first_date.localeCompare(b.first_date) || a.key.localeCompare(b.key)),
)
// Summed in the list's currency alone, as the page's totals are.
const summed = computed(() => ordered.value.filter((item) => item.currency === props.currency))

const total = computed(() => summed.value.reduce((sum, item) => sum + Number(item.paid_total), 0))
const monthly = computed(() =>
  summed.value.filter(isInTotal).reduce((sum, item) => sum + Number(item.monthly_equivalent), 0),
)
const oldest = computed(() => summed.value[0])
const running = computed(() => props.items.filter(isCurrent).length)
const ended = computed(() => props.items.length - running.value)

// Eight colours: past seven recurrings, the rest share the last one.
const MAX_SERIES = 8
const series = computed(() => {
  const named = summed.value.map((item) => ({ name: item.name, months: item.paid_by_month }))
  if (named.length <= MAX_SERIES) return named
  const others = new Map<string, number>()
  for (const s of named.slice(MAX_SERIES - 1)) {
    for (const m of s.months) others.set(m.month, (others.get(m.month) ?? 0) + Number(m.amount))
  }
  return [
    ...named.slice(0, MAX_SERIES - 1),
    { name: 'Autres', months: [...others].map(([month, amount]) => ({ month, amount })) },
  ]
})

function money(value: number, currency = props.currency): string {
  return maskValue(formatCurrency(Number(value), currency))
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count > 1 ? 's' : ''}`
}
</script>

<template>
  <BaseModal :open="open" :title="title" size="xl" scroll-fade @close="$emit('close')">
    <div class="space-y-6">
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <BaseStatCard
          :label="income ? 'Reçu en tout' : 'Payé en tout'"
          :value="money(total)"
          :sub-value="oldest ? `${oldest.since_at_least ? 'au moins depuis' : 'depuis'} le ${formatDate(oldest.first_date)}` : undefined"
        />
        <BaseStatCard
          label="Par mois"
          :value="money(monthly)"
          :sub-value="`≈ ${money(monthly * 12)} par an`"
        />
        <BaseStatCard
          :label="income ? 'Revenus récurrents' : 'Paiements récurrents'"
          :value="`${running} en cours`"
          :sub-value="ended ? plural(ended, 'terminé') : undefined"
        />
      </div>

      <section v-if="series.length">
        <h3 class="mb-2 text-sm font-semibold text-text-main dark:text-text-dark-main">Mois par mois</h3>
        <RecurringMonthsChart :series="series" :format="(value) => money(value)" />
      </section>

      <section>
        <h3 class="mb-1.5 text-sm font-semibold text-text-main dark:text-text-dark-main">
          {{ plural(items.length, income ? 'revenu' : 'paiement') }}
        </h3>
        <ul class="divide-y divide-surface-border dark:divide-surface-dark-border">
          <li v-for="item in ordered" :key="item.key" class="flex items-center gap-3 py-2.5">
            <div class="min-w-0 flex-1">
              <p class="flex items-center gap-1.5 text-sm font-medium text-text-main dark:text-text-dark-main">
                <span class="truncate" :title="item.name">{{ item.name }}</span>
                <BaseBadge v-if="!isCurrent(item)" variant="secondary">Terminé</BaseBadge>
              </p>
              <p class="mt-0.5 text-xs text-text-muted dark:text-text-dark-muted tabular-nums">
                {{ formatDate(item.first_date) }} → {{ isCurrent(item) ? 'en cours' : formatDate(item.last_date) }} ·
                {{ plural(item.occurrence_count, 'échéance') }}
              </p>
            </div>
            <div class="shrink-0 text-right">
              <p class="text-sm font-semibold tabular-nums text-text-main dark:text-text-dark-main">
                {{ money(item.paid_total, item.currency) }}
              </p>
              <p v-if="isCurrent(item)" class="text-xs text-text-muted dark:text-text-dark-muted tabular-nums">
                {{ money(item.monthly_equivalent, item.currency) }} / mois
              </p>
            </div>
          </li>
        </ul>
      </section>
    </div>
  </BaseModal>
</template>
