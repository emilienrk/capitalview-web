<script setup lang="ts">
/** One completed month of the real cashflow, its neighbours, and where its money went. */
import { computed } from 'vue'
import { ArrowLeft, ChevronLeft, ChevronRight, Repeat, Search } from 'lucide-vue-next'

import { BaseButton, BaseCard } from '@/components'
import RealCashflowCounterparts from '@/components/cashflow/RealCashflowCounterparts.vue'
import RealCashflowCoverage from '@/components/cashflow/RealCashflowCoverage.vue'
import RealCashflowOpenQuestions from '@/components/cashflow/RealCashflowOpenQuestions.vue'
import { useFormatters } from '@/composables/useFormatters'
import { usePrivacyMode } from '@/composables/usePrivacyMode'
import { exploreLink } from '@/utils/ledger'
import type { RealCashflowMonthDetail } from '@/types'

const props = defineProps<{ data: RealCashflowMonthDetail }>()

const emit = defineEmits<{ back: []; previous: []; next: [] }>()

const { formatCurrency } = useFormatters()
const { maskValue } = usePrivacyMode()

function amount(value: number): string {
  return maskValue(formatCurrency(Number(value), props.data.currency))
}

const title = computed(() => {
  const [year, month] = props.data.period.split('-').map(Number)
  return new Date(year!, month! - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
})

const figures = computed(() => {
  const totals = props.data.totals
  return [
    { label: 'Entrées', value: totals.income, tone: 'text-success', split: { recurring: totals.recurring_income, oneOff: totals.one_off_income } },
    { label: 'Dépenses', value: totals.expenses, tone: 'text-danger', split: { recurring: totals.recurring, oneOff: totals.one_off } },
    { label: 'Épargne', value: totals.saving, tone: 'text-primary', split: null },
    { label: 'Investissement', value: totals.investment, tone: 'text-info', split: null },
    { label: 'Reste', value: totals.net, tone: 'text-text-main dark:text-text-dark-main', split: null },
  ]
})

// An API older than recurring payments, or income, sends none: an empty line, not a crash.
const recurringLines = computed(() => [
  { key: 'expense', title: 'Paiements récurrents', query: {}, items: props.data.recurring ?? [] },
  { key: 'income', title: 'Revenus récurrents', query: { direction: 'income' }, items: props.data.recurring_income ?? [] },
].filter((line) => line.items.length))
const range = computed(() => ({ from: props.data.period, to: props.data.period }))
const explore = computed(() => ({
  name: 'cashflow',
  query: exploreLink({ preset: 'custom', from: props.data.period, to: props.data.period }, { by: 'group' }),
}))
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <BaseButton variant="ghost" size="sm" @click="emit('back')">
        <ArrowLeft class="w-4 h-4 mr-1" /> Retour à {{ data.period.slice(0, 4) }}
      </BaseButton>
      <div class="flex items-center gap-1">
        <BaseButton icon size="sm" variant="ghost" aria-label="Mois précédent" :disabled="!data.previous_period" @click="emit('previous')">
          <ChevronLeft class="w-4 h-4" />
        </BaseButton>
        <h3 class="w-44 text-center text-lg font-semibold capitalize text-text-main dark:text-text-dark-main">{{ title }}</h3>
        <BaseButton icon size="sm" variant="ghost" aria-label="Mois suivant" :disabled="!data.next_period" @click="emit('next')">
          <ChevronRight class="w-4 h-4" />
        </BaseButton>
      </div>
    </div>

    <div class="space-y-2">
      <RealCashflowOpenQuestions
        :count="data.open_questions"
        :amount="data.open_amount"
        :currency="data.currency"
        :year="Number(data.period.slice(0, 4))"
      />
      <RealCashflowCoverage :gaps="data.coverage_gaps" />
    </div>

    <BaseCard>
      <div class="grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5 gap-4">
        <div v-for="figure in figures" :key="figure.label">
          <p class="text-sm text-text-muted dark:text-text-dark-muted">{{ figure.label }}</p>
          <p :class="['text-xl font-bold tabular-nums', figure.tone]">{{ amount(figure.value) }}</p>
          <p v-if="figure.split && Number(figure.split.recurring)" class="text-xs text-text-muted dark:text-text-dark-muted">
            {{ amount(figure.split.recurring) }} qui reviennent · {{ amount(figure.split.oneOff) }} ponctuels
          </p>
        </div>
      </div>
      <div class="mt-4 flex flex-wrap items-center justify-between gap-2">
        <p class="text-sm text-text-muted dark:text-text-dark-muted">
          <template v-if="data.totals.savings_rate !== null">
            Taux d'épargne : <strong class="text-text-main dark:text-text-dark-main tabular-nums">{{ Number(data.totals.savings_rate).toLocaleString('fr-FR') }} %</strong>
          </template>
        </p>
        <router-link :to="explore" class="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
          <Search class="w-4 h-4" /> Explorer ce mois
        </router-link>
      </div>
      <p
        v-for="line in recurringLines"
        :key="line.key"
        class="mt-3 flex flex-wrap items-center gap-x-1.5 text-xs text-text-muted dark:text-text-dark-muted"
      >
        <Repeat class="w-3.5 h-3.5 shrink-0" />
        <router-link :to="{ name: 'bank-recurring', query: line.query }" class="font-medium hover:underline">{{ line.title }}</router-link> :
        <span v-for="(recurring, index) in line.items" :key="recurring.key">
          {{ recurring.name }} {{ amount(recurring.amount) }}{{ index < line.items.length - 1 ? ',' : '' }}
        </span>
      </p>
      <p v-for="other in data.other_currencies" :key="other.currency" class="mt-3 text-xs text-text-muted dark:text-text-dark-muted">
        En {{ other.currency }}, à part faute de taux : {{ maskValue(formatCurrency(other.outflow, other.currency)) }} en sortie,
        {{ maskValue(formatCurrency(other.inflow, other.currency)) }} en entrée.
      </p>
      <p v-if="Number(data.totals.neutral)" class="mt-3 text-xs text-text-muted dark:text-text-dark-muted">
        Hors {{ amount(data.totals.neutral) }} non comptés : déplacés entre vos comptes, remboursés ou annulés.
      </p>
    </BaseCard>

    <RealCashflowCounterparts
      :sources="data.top_sources"
      :destinations="data.top_destinations"
      :expenses="data.top_expenses"
      :currency="data.currency"
      :range="range"
    />
  </div>
</template>
