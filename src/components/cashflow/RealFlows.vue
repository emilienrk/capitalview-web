<script setup lang="ts">
import { ArrowDown, ArrowUp, Info, Scale, TriangleAlert } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { useBankStore } from '@/stores/bank'
import { useFormatters } from '@/composables/useFormatters'
import { usePrivacyMode } from '@/composables/usePrivacyMode'
import { BaseAlert, BaseSkeleton, BaseStatCard, BaseToggle } from '@/components'
import type { BankFlowsResponse } from '@/types'

const bank = useBankStore()
const { formatCurrency } = useFormatters()
const { maskValue } = usePrivacyMode()

const WINDOWS = [
  { months: 6, label: '6 mois' },
  { months: 12, label: '12 mois' },
  { months: 24, label: '24 mois' },
]

const months = ref(12)
const excludeInternalTransfers = ref(true)
const flows = ref<BankFlowsResponse | null>(null)
const isLoading = ref(true)
const error = ref<string | null>(null)

async function load(): Promise<void> {
  isLoading.value = true
  error.value = null
  try {
    flows.value = await bank.fetchRealFlows(months.value, excludeInternalTransfers.value)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Impossible de lire vos mouvements.'
  } finally {
    isLoading.value = false
  }
}

watch([months, excludeInternalTransfers], load, { immediate: true })

const hasMovements = computed(() => (flows.value?.covered_months ?? 0) > 0)

/** Bars are drawn against the tallest single side, so both scales stay comparable. */
const scale = computed(() => {
  const peak = Math.max(
    0,
    ...(flows.value?.months ?? []).flatMap((m) => [m.inflow, m.outflow]),
  )
  return peak || 1
})

/** "2026-03" → "mars 26", in the user's own locale. */
function monthLabel(period: string): string {
  const [year, month] = period.split('-')
  const formatted = new Date(Number(year), Number(month) - 1, 1)
  return new Intl.DateTimeFormat(undefined, { month: 'short', year: '2-digit' }).format(formatted)
}
</script>

<template>
  <div>
    <!-- Window and the one knob that changes what the totals mean -->
    <div class="flex flex-wrap items-center justify-between gap-4 mb-6">
      <div class="inline-flex rounded-card border border-surface-border dark:border-surface-dark-border p-1 bg-surface dark:bg-surface-dark">
        <button
          v-for="w in WINDOWS"
          :key="w.months"
          type="button"
          :class="[
            'px-3 py-1.5 text-sm rounded-secondary transition-colors',
            months === w.months
              ? 'bg-primary text-white font-medium'
              : 'text-text-muted dark:text-text-dark-muted hover:text-text-main dark:hover:text-text-dark-main',
          ]"
          @click="months = w.months"
        >
          {{ w.label }}
        </button>
      </div>

      <label class="flex items-center gap-2 text-sm text-text-body dark:text-text-dark-body">
        <BaseToggle
          v-model="excludeInternalTransfers"
          aria-label="Exclure les virements entre vos propres comptes"
        />
        Exclure les virements entre vos comptes
      </label>
    </div>

    <div v-if="isLoading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <BaseSkeleton v-for="i in 4" :key="i" variant="rect" height="6rem" />
    </div>

    <BaseAlert v-else-if="error" variant="danger">{{ error }}</BaseAlert>

    <BaseAlert v-else-if="!hasMovements" variant="info">
      <p class="font-medium">Aucun mouvement sur cette période.</p>
      <p class="mt-0.5 opacity-90">
        Synchronisez un compte connecté, ou importez l'export de votre banque depuis
        Réglages → Banque pour remonter plus loin que la fenêtre de l'API.
      </p>
    </BaseAlert>

    <template v-else-if="flows">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <BaseStatCard
          label="Entrées observées"
          :value="maskValue(formatCurrency(flows.inflow))"
          :sub-value="`${maskValue(formatCurrency(flows.monthly_inflow))} / mois`"
          sub-value-class="text-success"
        >
          <template #icon>
            <div class="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center">
              <ArrowUp class="w-5 h-5 text-success" />
            </div>
          </template>
        </BaseStatCard>

        <BaseStatCard
          label="Sorties observées"
          :value="maskValue(formatCurrency(flows.outflow))"
          :sub-value="`${maskValue(formatCurrency(flows.monthly_outflow))} / mois`"
          sub-value-class="text-danger"
        >
          <template #icon>
            <div class="w-10 h-10 rounded-full bg-danger/10 flex items-center justify-center">
              <ArrowDown class="w-5 h-5 text-danger" />
            </div>
          </template>
        </BaseStatCard>

        <BaseStatCard
          label="Net observé"
          :value="maskValue(formatCurrency(flows.net))"
          :sub-value-class="flows.net >= 0 ? 'text-success' : 'text-danger'"
        >
          <template #icon>
            <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Scale class="w-5 h-5 text-primary" />
            </div>
          </template>
        </BaseStatCard>

        <BaseStatCard
          label="Période couverte"
          :value="`${flows.covered_months} mois`"
          :sub-value="`${flows.account_count} compte(s) connecté(s)`"
        />
      </div>

      <!-- Month by month -->
      <div class="rounded-card bg-surface dark:bg-surface-dark border border-surface-border dark:border-surface-dark-border p-5 shadow-soft mb-6 overflow-x-auto">
        <h3 class="text-sm font-semibold text-text-main dark:text-text-dark-main mb-4">
          Mois par mois
        </h3>
        <div class="flex items-end gap-3 min-w-max h-48">
          <div
            v-for="m in flows.months"
            :key="m.period"
            class="flex flex-col items-center gap-1 w-14"
            :title="`${monthLabel(m.period)} — ${m.inflow_count} entrée(s), ${m.outflow_count} sortie(s)`"
          >
            <div class="flex-1 flex items-end gap-1 w-full">
              <div class="flex-1 flex items-end h-full">
                <div
                  class="w-full rounded-t bg-success/70"
                  :style="{ height: `${(m.inflow / scale) * 100}%` }"
                />
              </div>
              <div class="flex-1 flex items-end h-full">
                <div
                  class="w-full rounded-t bg-danger/70"
                  :style="{ height: `${(m.outflow / scale) * 100}%` }"
                />
              </div>
            </div>
            <span class="text-[10px] text-text-muted dark:text-text-dark-muted whitespace-nowrap">
              {{ monthLabel(m.period) }}
            </span>
          </div>
        </div>
      </div>

      <!-- Everything the totals deliberately leave out -->
      <div class="space-y-3">
        <BaseAlert v-if="flows.internal_transfers_excluded" variant="info">
          <p class="font-medium">
            {{ flows.internal_transfers_excluded }} virement(s) entre vos comptes exclu(s)
            ({{ maskValue(formatCurrency(flows.internal_transfers_amount)) }}).
          </p>
          <p class="mt-0.5 opacity-90">
            Déplacer de l'argent d'un compte à l'autre n'est ni un revenu ni une dépense.
          </p>
        </BaseAlert>

        <BaseAlert v-if="excludeInternalTransfers" variant="warning">
          <p class="font-medium">Un virement vers un compte non connecté compte comme une sortie.</p>
          <p class="mt-0.5 opacity-90">
            Les deux côtés d'un virement ne sont reconnus que si les deux comptes sont connectés ici.
            Connecter votre livret ou votre second compte rend ces totaux plus justes.
          </p>
        </BaseAlert>

        <BaseAlert v-if="flows.pending_count" variant="info">
          <Info class="w-4 h-4 inline mr-1" />
          {{ flows.pending_count }} opération(s) encore en attente
          ({{ maskValue(formatCurrency(flows.pending_outflow)) }} en sortie) — hors totaux tant que
          la banque ne les a pas comptabilisées.
        </BaseAlert>

        <BaseAlert v-if="flows.other_currencies.length" variant="warning">
          <TriangleAlert class="w-4 h-4 inline mr-1" />
          Mouvements dans une autre devise, laissés hors des totaux faute de taux de change :
          <span v-for="c in flows.other_currencies" :key="c.currency" class="font-medium">
            {{ c.currency }} (+{{ c.inflow }} / −{{ c.outflow }})
          </span>
        </BaseAlert>
      </div>
    </template>
  </div>
</template>
