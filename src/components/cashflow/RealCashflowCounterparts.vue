<script setup lang="ts">
/**
 * Where the money went and where it came from, by counterpart rather than by
 * category: nothing to sort, and most of what a category would have told.
 * Each line opens the Explorer on that counterpart over the same period.
 */
import { computed, ref } from 'vue'

import { BaseCard, BaseSegmentedControl } from '@/components'
import { useFormatters } from '@/composables/useFormatters'
import { usePrivacyMode } from '@/composables/usePrivacyMode'
import { exploreLink, type PeriodRange } from '@/utils/ledger'
import type { RealCashflowCounterpart, RealCashflowExpense } from '@/types'

const props = defineProps<{
  sources: RealCashflowCounterpart[]
  destinations: RealCashflowCounterpart[]
  expenses: RealCashflowExpense[]
  currency: string
  range: PeriodRange
}>()

const { formatCurrency, formatDate } = useFormatters()
const { maskValue } = usePrivacyMode()

type Tab = 'destinations' | 'sources' | 'expenses'
const tab = ref<Tab>('destinations')
const tabs = [
  { label: "Où va l'argent", value: 'destinations' },
  { label: "D'où il vient", value: 'sources' },
  { label: 'Plus grosses', value: 'expenses' },
]

const lines = computed(() => (tab.value === 'sources' ? props.sources : props.destinations))

function amount(value: number): string {
  return maskValue(formatCurrency(Number(value), props.currency))
}

function link(line: RealCashflowCounterpart) {
  const credit = tab.value === 'sources'
  return {
    name: 'cashflow',
    query: exploreLink(
      { preset: 'custom', from: props.range.from, to: props.range.to, groups: [`${credit ? 'C' : 'D'}:${line.group_key}`] },
      { by: 'month' },
    ),
  }
}
</script>

<template>
  <BaseCard title="Contreparties" subtitle="Sans rien trier : lues sur les libellés" :padding="false">
    <div class="px-4 sm:px-6 pb-3 overflow-x-auto">
      <BaseSegmentedControl v-model="tab" :options="tabs" size="sm" />
    </div>

    <ul v-if="tab !== 'expenses' && lines.length" class="divide-y divide-surface-border dark:divide-surface-dark-border">
      <li v-for="line in lines" :key="line.group_key">
        <router-link :to="link(line)" class="block px-4 sm:px-6 py-3 hover:bg-surface-hover dark:hover:bg-surface-dark-hover">
          <div class="flex items-baseline justify-between gap-3">
            <p class="min-w-0 truncate text-sm font-medium text-text-main dark:text-text-dark-main" :title="line.name">{{ line.name }}</p>
            <p class="shrink-0 text-sm font-semibold tabular-nums text-text-main dark:text-text-dark-main">{{ amount(line.amount) }}</p>
          </div>
          <div class="mt-1.5 flex items-center gap-3">
            <div class="h-1.5 flex-1 rounded-full bg-background-subtle dark:bg-background-dark-subtle overflow-hidden">
              <div
                :class="['h-full rounded-full', tab === 'sources' ? 'bg-success/70' : 'bg-danger/70']"
                :style="{ width: `${Math.max(2, Number(line.share))}%` }"
              />
            </div>
            <p class="shrink-0 w-32 text-right text-xs tabular-nums text-text-muted dark:text-text-dark-muted">
              {{ Number(line.share).toLocaleString('fr-FR') }} % · {{ line.operation_count }} op.
            </p>
          </div>
        </router-link>
      </li>
    </ul>

    <ul v-else-if="tab === 'expenses' && expenses.length" class="divide-y divide-surface-border dark:divide-surface-dark-border">
      <li v-for="expense in expenses" :key="expense.id" class="flex items-center gap-3 px-4 sm:px-6 py-3">
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium text-text-main dark:text-text-dark-main" :title="expense.label ?? undefined">
            {{ expense.label ?? 'Opération sans libellé' }}
          </p>
          <p class="mt-0.5 text-xs text-text-muted dark:text-text-dark-muted">
            {{ formatDate(expense.operation_date) }} · {{ expense.account_name }}
          </p>
        </div>
        <p class="shrink-0 text-sm font-semibold tabular-nums text-text-main dark:text-text-dark-main">{{ amount(-expense.amount) }}</p>
      </li>
    </ul>

    <p v-else class="px-4 sm:px-6 pb-4 text-sm text-text-muted dark:text-text-dark-muted">Rien sur cette période.</p>
  </BaseCard>
</template>
