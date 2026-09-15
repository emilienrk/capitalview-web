<script setup lang="ts">
/** One completed month of the real cashflow, its categories, and its neighbours. */
import { computed } from 'vue'
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-vue-next'

import { BaseButton, BaseCard } from '@/components'
import RealCashflowCategoryList from '@/components/cashflow/RealCashflowCategoryList.vue'
import { useFormatters } from '@/composables/useFormatters'
import { usePrivacyMode } from '@/composables/usePrivacyMode'
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

const figures = computed(() => [
  { label: 'Entrées', value: props.data.totals.income, tone: 'text-success' },
  { label: 'Dépenses', value: props.data.totals.expenses, tone: 'text-danger' },
  { label: 'Mis de côté', value: props.data.totals.saving, tone: 'text-primary' },
  { label: 'Investi', value: props.data.totals.investment, tone: 'text-info' },
])
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

    <BaseCard>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div v-for="figure in figures" :key="figure.label">
          <p class="text-sm text-text-muted dark:text-text-dark-muted">{{ figure.label }}</p>
          <p :class="['text-xl font-bold tabular-nums', figure.tone]">{{ amount(figure.value) }}</p>
        </div>
      </div>
      <p v-for="other in data.other_currencies" :key="other.currency" class="mt-3 text-xs text-text-muted dark:text-text-dark-muted">
        En {{ other.currency }}, à part faute de taux : {{ maskValue(formatCurrency(other.outflow, other.currency)) }} en sortie,
        {{ maskValue(formatCurrency(other.inflow, other.currency)) }} en entrée.
      </p>
    </BaseCard>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <BaseCard title="Sorties par catégorie">
        <RealCashflowCategoryList :shares="data.by_category.expenses" :format="amount" bar-class="bg-danger/70" empty="Aucune dépense ce mois-ci" />
      </BaseCard>
      <BaseCard title="Entrées par catégorie">
        <RealCashflowCategoryList :shares="data.by_category.income" :format="amount" bar-class="bg-success/70" empty="Aucune entrée ce mois-ci" />
      </BaseCard>
    </div>
  </div>
</template>
