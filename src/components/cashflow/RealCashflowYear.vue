<script setup lang="ts">
/**
 * A year of the real cashflow: monthly figures by type, the months side by
 * side, and the largest expenses — shown, never taken out of the totals.
 */
import { computed } from 'vue'
import { ArrowDown, ArrowUp, PiggyBank, Scale, TrendingUp } from 'lucide-vue-next'

import { BaseCard, BaseSegmentedControl, BaseSelect, BaseStatCard } from '@/components'
import CashflowMonthsBarChart from '@/components/charts/CashflowMonthsBarChart.vue'
import RealCashflowOpenQuestions from '@/components/cashflow/RealCashflowOpenQuestions.vue'
import { useFormatters } from '@/composables/useFormatters'
import { usePrivacyMode } from '@/composables/usePrivacyMode'
import { monthlyFigures, type MonthlyStatistic } from '@/utils/realCashflow'
import type { RealCashflowYear } from '@/types'

const props = defineProps<{
  data: RealCashflowYear
  statistic: MonthlyStatistic
  isDark?: boolean
}>()

const emit = defineEmits<{
  'update:statistic': [value: MonthlyStatistic]
  'select-year': [year: number]
  'select-month': [period: string]
}>()

const { formatCurrency } = useFormatters()
const { maskValue } = usePrivacyMode()

function amount(value: number): string {
  return maskValue(formatCurrency(Number(value), props.data.currency))
}

const yearOptions = computed(() =>
  [...props.data.years_available].reverse().map((year) => ({ label: String(year), value: year })),
)

const statisticOptions = [
  { label: 'Moyenne', value: 'mean' },
  { label: 'Médiane', value: 'median' },
]

const monthly = computed(() => monthlyFigures(props.data, props.statistic))
const perMonth = computed(() => (props.statistic === 'median' ? 'médiane / mois' : 'moyenne / mois'))

const cards = computed(() => [
  { label: 'Entrées', key: 'income', icon: ArrowUp, tone: 'bg-success/10 text-success' },
  { label: 'Dépenses', key: 'expenses', icon: ArrowDown, tone: 'bg-danger/10 text-danger' },
  { label: 'Épargne', key: 'saving', icon: PiggyBank, tone: 'bg-primary/10 text-primary' },
  { label: 'Investissement', key: 'investment', icon: TrendingUp, tone: 'bg-info/10 text-info' },
  { label: 'Reste', key: 'net', icon: Scale, tone: 'bg-background-subtle dark:bg-background-dark-subtle text-text-main dark:text-text-dark-main' },
] as const)

function monthName(period: string): string {
  const [year, month] = period.split('-').map(Number)
  return new Date(year!, month! - 1, 1).toLocaleDateString('fr-FR', { month: 'long' })
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="w-32">
        <BaseSelect
          :model-value="data.year"
          :options="yearOptions"
          aria-label="Année"
          @update:model-value="(year) => year !== undefined && emit('select-year', Number(year))"
        />
      </div>
      <BaseSegmentedControl
        :model-value="statistic"
        :options="statisticOptions"
        size="sm"
        @update:model-value="(value) => emit('update:statistic', value as MonthlyStatistic)"
      />
    </div>

    <p v-if="!data.covered_months" class="text-sm text-text-muted dark:text-text-dark-muted">
      Aucun mois terminé de {{ data.year }} ne porte d'opération.
    </p>

    <template v-else>
      <RealCashflowOpenQuestions :count="data.open_questions" />
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <BaseStatCard
          v-for="card in cards"
          :key="card.key"
          :label="card.label"
          :value="amount(monthly[card.key])"
          :sub-value="`${perMonth} · ${amount(data.totals[card.key])} sur l'année`"
        >
          <template #icon>
            <div :class="['w-10 h-10 rounded-full flex items-center justify-center', card.tone]">
              <component :is="card.icon" class="w-5 h-5" />
            </div>
          </template>
        </BaseStatCard>
      </div>
      <p class="-mt-3 text-xs text-text-muted dark:text-text-dark-muted">
        Sur {{ data.covered_months }} mois terminé{{ data.covered_months > 1 ? 's' : '' }} portant des opérations.
        <template v-if="Number(data.totals.neutral)">
          Hors {{ amount(data.totals.neutral) }} neutres : déplacés entre vos comptes, remboursés ou annulés.
        </template>
      </p>
      <p v-for="other in data.other_currencies" :key="other.currency" class="-mt-3 text-xs text-text-muted dark:text-text-dark-muted">
        En {{ other.currency }}, à part faute de taux : {{ maskValue(formatCurrency(other.outflow, other.currency)) }} en sortie,
        {{ maskValue(formatCurrency(other.inflow, other.currency)) }} en entrée.
      </p>

      <BaseCard title="Mois par mois" subtitle="Cliquez un mois pour le détailler">
        <CashflowMonthsBarChart :months="data.months" :format="amount" :is-dark="isDark" @select="emit('select-month', $event)" />
        <div class="mt-4 flex flex-wrap gap-2">
          <button
            v-for="m in data.months"
            :key="m.period"
            type="button"
            :disabled="!m.operation_count"
            class="px-3 py-1.5 rounded-button text-xs font-medium capitalize bg-background-subtle dark:bg-background-dark-subtle text-text-muted dark:text-text-dark-muted hover:text-text-main dark:hover:text-text-dark-main disabled:opacity-40 disabled:cursor-not-allowed"
            @click="emit('select-month', m.period)"
          >
            {{ monthName(m.period) }}
          </button>
        </div>
      </BaseCard>

      <BaseCard v-if="data.top_expenses.length" title="Les plus grosses dépenses" subtitle="Comptées dans les totaux" :padding="false">
        <ul class="divide-y divide-surface-border dark:divide-surface-dark-border">
          <li v-for="expense in data.top_expenses" :key="expense.id" class="flex items-center gap-3 px-4 sm:px-6 py-3">
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium text-text-main dark:text-text-dark-main" :title="expense.label ?? undefined">
                {{ expense.label ?? 'Opération sans libellé' }}
              </p>
              <p class="mt-0.5 text-xs text-text-muted dark:text-text-dark-muted">
                {{ expense.operation_date }} · {{ expense.account_name }}
              </p>
            </div>
            <p class="shrink-0 text-sm font-semibold tabular-nums text-text-main dark:text-text-dark-main">{{ amount(-expense.amount) }}</p>
          </li>
        </ul>
      </BaseCard>
    </template>
  </div>
</template>
