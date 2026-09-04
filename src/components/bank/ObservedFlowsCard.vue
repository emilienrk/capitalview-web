<script setup lang="ts">
/**
 * What actually moved on the user's accounts, month by month.
 *
 * The counterpart of the Flux de trésorerie page, which shows what they
 * *declared* would move. Read from the stored bank movements, so it needs no
 * network and answers even when the open-banking feature is switched off.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { RefreshCw } from 'lucide-vue-next'

import { useBankStore } from '@/stores/bank'
import { useFormatters } from '@/composables/useFormatters'
import { usePrivacyMode } from '@/composables/usePrivacyMode'
import {
  BaseAlert, BaseBadge, BaseButton, BaseCard, BaseEmptyState, BaseSegmentedControl, BaseSkeleton,
} from '@/components'

const bank = useBankStore()
const { formatCurrency } = useFormatters()
const { maskValue } = usePrivacyMode()

// The control's options are typed as strings, so the window travels as one and
// is read back as a number where it is used.
const months = ref('12')
const windowOptions = [
  { label: '6 mois', value: '6' },
  { label: '12 mois', value: '12' },
  { label: '24 mois', value: '24' },
]

const flows = computed(() => bank.observedFlows)
const hasData = computed(() => (flows.value?.covered_months ?? 0) > 0)

/** Newest first: the month someone wants to read is the one just gone. */
const monthRows = computed(() =>
  [...(flows.value?.months ?? [])].reverse().filter((m) => m.inflow_count || m.outflow_count),
)

/** Bar widths are relative to the busiest month, so a quiet one stays visible. */
const scale = computed(() => {
  const peak = Math.max(0, ...monthRows.value.flatMap((m) => [m.inflow, m.outflow]))
  return peak > 0 ? peak : 1
})

function monthLabel(period: string): string {
  const [year, month] = period.split('-')
  return new Date(Number(year), Number(month) - 1, 1)
    .toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}

function amount(value: number): string {
  return maskValue(formatCurrency(value, flows.value?.currency ?? 'EUR'))
}

function load(force = false): void {
  void bank.fetchObservedFlows(Number(months.value), force)
}

onMounted(() => load())
watch(months, () => load())
</script>

<template>
  <BaseCard class="mb-6">
    <template #header>
      <div class="flex items-start sm:items-center justify-between gap-3">
        <div>
          <h3 class="text-lg font-semibold text-text-main dark:text-text-dark-main">
            Ce qui a réellement bougé
          </h3>
          <p class="text-sm text-text-muted dark:text-text-dark-muted mt-0.5">
            Mesuré sur vos opérations bancaires, pas sur vos flux déclarés
          </p>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <BaseSegmentedControl v-model="months" :options="windowOptions" variant="primary" size="sm" />
          <BaseButton icon size="sm" variant="outline" @click="load(true)">
            <RefreshCw class="w-4 h-4" />
          </BaseButton>
        </div>
      </div>
    </template>

    <div v-if="bank.observedFlowsLoading && !flows" class="space-y-3">
      <BaseSkeleton variant="rect" width="100%" height="4rem" />
      <BaseSkeleton variant="rect" width="100%" height="10rem" />
    </div>

    <BaseEmptyState
      v-else-if="!hasData"
      title="Aucun mouvement enregistré"
      description="Synchronisez une banque ou importez un relevé d'opérations pour voir vos dépenses réelles."
    />

    <template v-else-if="flows">
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <div>
          <p class="text-sm text-text-muted dark:text-text-dark-muted">Entrées / mois</p>
          <p class="text-xl font-bold text-success">{{ amount(flows.monthly_inflow) }}</p>
        </div>
        <div>
          <p class="text-sm text-text-muted dark:text-text-dark-muted">Sorties / mois</p>
          <p class="text-xl font-bold text-danger">{{ amount(flows.monthly_outflow) }}</p>
        </div>
        <div>
          <p class="text-sm text-text-muted dark:text-text-dark-muted">Solde sur la période</p>
          <p class="text-xl font-bold" :class="flows.net >= 0 ? 'text-success' : 'text-danger'">
            {{ amount(flows.net) }}
          </p>
        </div>
        <div>
          <p class="text-sm text-text-muted dark:text-text-dark-muted">Mois couverts</p>
          <p class="text-xl font-bold text-text-main dark:text-text-dark-main">
            {{ flows.covered_months }}
          </p>
          <p class="text-xs text-text-muted dark:text-text-dark-muted mt-0.5">
            sur {{ flows.account_count }} compte{{ flows.account_count > 1 ? 's' : '' }}
          </p>
        </div>
      </div>

      <!--
        Reported, never hidden: money moved between the user's own accounts is
        neither income nor spending, but "1 240 € déplacés" is an answer to
        "where did it go", and a total that silently swallowed it is not.
      -->
      <BaseAlert v-if="flows.internal_transfers_excluded > 0" variant="info" class="mb-4">
        {{ amount(flows.internal_transfers_amount) }} déplacés entre vos comptes
        ({{ flows.internal_transfers_excluded }} virement{{ flows.internal_transfers_excluded > 1 ? 's' : '' }}) :
        ni un revenu ni une dépense, donc hors des totaux.
      </BaseAlert>

      <div class="space-y-2">
        <div
          v-for="month in monthRows"
          :key="month.period"
          class="flex items-center gap-3 text-sm"
        >
          <span class="w-28 shrink-0 text-text-muted dark:text-text-dark-muted capitalize">
            {{ monthLabel(month.period) }}
          </span>
          <div class="flex-1 min-w-0 space-y-1">
            <div class="h-2 rounded-full bg-success/70" :style="{ width: `${(month.inflow / scale) * 100}%` }" />
            <div class="h-2 rounded-full bg-danger/70" :style="{ width: `${(month.outflow / scale) * 100}%` }" />
          </div>
          <span class="w-28 shrink-0 text-right font-medium" :class="month.net >= 0 ? 'text-success' : 'text-danger'">
            {{ amount(month.net) }}
          </span>
        </div>
      </div>

      <div class="mt-4 flex flex-wrap items-center gap-2">
        <BaseBadge v-for="name in flows.account_names" :key="name" variant="secondary">
          {{ name }}
        </BaseBadge>
      </div>

      <!-- Outside the monthly figures on purpose: not booked yet, so still movable. -->
      <p v-if="flows.pending_count > 0" class="mt-3 text-sm text-text-muted dark:text-text-dark-muted">
        {{ flows.pending_count }} opération{{ flows.pending_count > 1 ? 's' : '' }} en attente,
        hors totaux : {{ amount(flows.pending_outflow) }} en sortie,
        {{ amount(flows.pending_inflow) }} en entrée.
      </p>

      <!-- No exchange rate ever arrives with a movement, so these never join a total. -->
      <p
        v-for="other in flows.other_currencies"
        :key="other.currency"
        class="mt-1 text-sm text-text-muted dark:text-text-dark-muted"
      >
        En {{ other.currency }}, à part faute de taux :
        {{ maskValue(formatCurrency(other.outflow, other.currency)) }} en sortie,
        {{ maskValue(formatCurrency(other.inflow, other.currency)) }} en entrée.
      </p>
    </template>
  </BaseCard>
</template>
