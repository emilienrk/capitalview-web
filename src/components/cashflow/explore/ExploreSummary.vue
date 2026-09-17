<script setup lang="ts">
/** What the selection adds up to, against the period before and the year before. */
import { computed } from 'vue'
import { ArrowDownRight, ArrowUpRight, Hash, CalendarRange, HelpCircle } from 'lucide-vue-next'

import { useFormatters } from '@/composables/useFormatters'
import { usePrivacyMode } from '@/composables/usePrivacyMode'
import { CASHFLOW_TYPES, CASHFLOW_TYPE_LABELS } from '@/utils/cashflowTypes'
import type { Comparison, Direction, Summary } from '@/utils/ledger'

const props = defineProps<{
  summary: Summary
  months: number | null
  comparisons: { previous: Comparison; lastYear: Comparison } | null
  direction: Direction
  currency: string
}>()

const { formatCurrency } = useFormatters()
const { maskValue } = usePrivacyMode()

function amount(value: number): string {
  return maskValue(formatCurrency(value, props.currency))
}

const totalLabel = computed(() => ({ out: 'Sorti', in: 'Entré', all: 'Solde' })[props.direction])

/** Looking at what goes out, more is worse; anywhere else, more is better. */
function tone(change: number | null): string {
  if (props.direction === 'all' || change === null || Math.abs(change) < 1) return 'text-text-main dark:text-text-dark-main'
  const worse = props.direction === 'out' ? change > 0 : change < 0
  return worse ? 'text-danger' : 'text-success'
}

/**
 * In and out mixed, a balance can cross zero, where a percentage means
 * nothing: the difference in euros says it.
 */
function changeText(comparison: Comparison): string {
  if (props.direction === 'all') {
    const delta = props.summary.total - comparison.total
    return `${delta >= 0 ? '+' : '−'}${amount(Math.abs(delta))}`
  }
  if (comparison.change === null) return 'rien à comparer'
  const sign = comparison.change >= 0 ? '+' : '−'
  return `${sign}${Math.abs(comparison.change).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} %`
}

const types = computed(() => CASHFLOW_TYPES.filter((type) => type !== 'NEUTRAL' && props.summary.byType[type] !== 0))
</script>

<template>
  <div class="space-y-3">
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <div class="rounded-card bg-surface dark:bg-surface-dark border border-surface-border dark:border-surface-dark-border p-4 shadow-soft">
        <p class="flex items-center gap-1.5 text-xs font-medium text-text-muted dark:text-text-dark-muted">
          <component :is="direction === 'in' ? ArrowUpRight : ArrowDownRight" class="w-3.5 h-3.5" /> {{ totalLabel }}
        </p>
        <p class="mt-1 text-xl sm:text-2xl font-bold tabular-nums text-text-main dark:text-text-dark-main truncate">{{ amount(summary.total) }}</p>
        <p class="mt-0.5 text-xs text-text-muted dark:text-text-dark-muted truncate">
          +{{ amount(summary.inflow) }} / −{{ amount(summary.outflow) }}
        </p>
      </div>
      <div class="rounded-card bg-surface dark:bg-surface-dark border border-surface-border dark:border-surface-dark-border p-4 shadow-soft">
        <p class="flex items-center gap-1.5 text-xs font-medium text-text-muted dark:text-text-dark-muted"><Hash class="w-3.5 h-3.5" /> Opérations</p>
        <p class="mt-1 text-xl sm:text-2xl font-bold tabular-nums text-text-main dark:text-text-dark-main">{{ summary.count.toLocaleString('fr-FR') }}</p>
        <p class="mt-0.5 text-xs text-text-muted dark:text-text-dark-muted truncate">
          panier moyen {{ amount(summary.averageTicket) }} · médian {{ amount(summary.medianTicket) }}
        </p>
      </div>
      <div class="rounded-card bg-surface dark:bg-surface-dark border border-surface-border dark:border-surface-dark-border p-4 shadow-soft">
        <p class="flex items-center gap-1.5 text-xs font-medium text-text-muted dark:text-text-dark-muted"><CalendarRange class="w-3.5 h-3.5" /> Par mois</p>
        <p class="mt-1 text-xl sm:text-2xl font-bold tabular-nums text-text-main dark:text-text-dark-main truncate">
          {{ months ? amount(summary.total / months) : '—' }}
        </p>
        <p class="mt-0.5 text-xs text-text-muted dark:text-text-dark-muted">
          {{ months ? `sur ${months} mois` : 'sur toute la période' }}
        </p>
      </div>
      <div class="rounded-card bg-surface dark:bg-surface-dark border border-surface-border dark:border-surface-dark-border p-4 shadow-soft">
        <p class="text-xs font-medium text-text-muted dark:text-text-dark-muted">Comparaison</p>
        <template v-if="comparisons">
          <p :class="['mt-1 text-sm font-semibold tabular-nums', tone(comparisons.previous.change)]">
            {{ changeText(comparisons.previous) }}
            <span class="font-normal text-text-muted dark:text-text-dark-muted">vs période précédente</span>
          </p>
          <!-- A twelve-month period's previous one is the year before: said once. -->
          <p
            v-if="comparisons.lastYear.range.from !== comparisons.previous.range.from"
            :class="['mt-0.5 text-sm font-semibold tabular-nums', tone(comparisons.lastYear.change)]"
          >
            {{ changeText(comparisons.lastYear) }}
            <span class="font-normal text-text-muted dark:text-text-dark-muted">vs un an avant</span>
          </p>
        </template>
        <p v-else class="mt-1 text-sm text-text-muted dark:text-text-dark-muted">Choisissez une période pour comparer.</p>
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted dark:text-text-dark-muted">
      <span v-for="type in types" :key="type">
        {{ CASHFLOW_TYPE_LABELS[type] }} <strong class="tabular-nums text-text-main dark:text-text-dark-main">{{ amount(summary.byType[type]) }}</strong>
      </span>
      <router-link v-if="summary.openAmount > 0" :to="{ name: 'bank-review' }" class="inline-flex items-center gap-1 font-medium text-warning hover:underline">
        <HelpCircle class="w-3.5 h-3.5" /> dont {{ amount(summary.openAmount) }} encore à confirmer
      </router-link>
    </div>
  </div>
</template>
