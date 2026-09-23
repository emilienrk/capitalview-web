<script setup lang="ts">
/**
 * The Explorer: every operation of the history, filtered, split and compared
 * in the browser. Figures move as filters change, without a request; the
 * operations and their types come from the ledger, the same reading the Réel
 * view totals.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { Compass, Landmark } from 'lucide-vue-next'

import { BaseAlert, BaseButton, BaseCard, BaseEmptyState, BaseSegmentedControl, BaseSkeleton, BaseToggle } from '@/components'
import BankTypePicker from '@/components/bank/BankTypePicker.vue'
import ExploreBreakdown from '@/components/cashflow/explore/ExploreBreakdown.vue'
import ExploreChart from '@/components/cashflow/explore/ExploreChart.vue'
import ExploreFilters from '@/components/cashflow/explore/ExploreFilters.vue'
import ExploreOperations from '@/components/cashflow/explore/ExploreOperations.vue'
import ExploreSummary from '@/components/cashflow/explore/ExploreSummary.vue'
import { useDarkMode } from '@/composables/useDarkMode'
import { useExploreFilters } from '@/composables/useExploreFilters'
import { useFormatters } from '@/composables/useFormatters'
import { usePrivacyMode } from '@/composables/usePrivacyMode'
import { useBankStore } from '@/stores/bank'
import { useLedgerStore } from '@/stores/ledger'
import { CASHFLOW_TYPE_LABELS } from '@/utils/cashflowTypes'
import {
  DEFAULT_FILTERS, amountBandFilter, applyFilters, comparePeriods, cumulated, groupBy, periodRange, periodsBetween,
  shiftPeriod, shiftRange, summarize, timeSeries, toCsv, toPeriod, type Bucket, type LedgerEntry, type LedgerFilters,
} from '@/utils/ledger'
import type { ExploreState } from '@/utils/ledger'
import type { BankTransactionItem, BankTransactionTypeResult, CashflowType, OperationType } from '@/types'

const ledger = useLedgerStore()
const bank = useBankStore()
const { isDark } = useDarkMode()
const { formatCurrency } = useFormatters()
const { privacyMode } = usePrivacyMode()
const { state, reset } = useExploreFilters()

onMounted(() => void ledger.fetchLedger())
// A sync, an import or an answer rewrote how operations count.
watch(() => bank.dataRevision, () => void ledger.fetchLedger())

const today = new Date()
const currency = computed(() => ledger.ledger?.currency ?? 'EUR')
const entries = computed(() => ledger.entries)

const filters = computed({
  get: () => state.value.filters,
  set: (value: LedgerFilters) => { state.value = { ...state.value, filters: value } },
})

const range = computed(() => periodRange(state.value.filters, today))
const selected = computed(() => applyFilters(entries.value, state.value.filters, range.value, currency.value))
const summary = computed(() => summarize(selected.value, state.value.filters.direction))
const months = computed(() => {
  if (range.value) return periodsBetween(range.value).length
  return new Set(selected.value.map((entry) => entry.period).filter(Boolean)).size || null
})
const comparisons = computed(() => comparePeriods(entries.value, state.value.filters, range.value, currency.value))

/** The span the chart draws: the period, or the history the selection covers. */
const chartRange = computed(() => {
  if (range.value) return range.value
  const periods = selected.value.map((entry) => entry.period).filter(Boolean).sort()
  return periods.length ? { from: periods[0]!, to: periods[periods.length - 1]! } : null
})

const series = computed(() =>
  chartRange.value ? timeSeries(selected.value, chartRange.value, state.value.stack, state.value.filters.direction) : null,
)
const cumulative = computed(() =>
  state.value.cumulative && range.value ? cumulated(entries.value, state.value.filters, range.value, currency.value) : null,
)

const sparkPeriods = computed(() => {
  const end = chartRange.value?.to ?? toPeriod(today)
  return Array.from({ length: 12 }, (_, i) => shiftPeriod(end, i - 11))
})
const buckets = computed(() => groupBy(selected.value, state.value.by, state.value.filters.direction, sparkPeriods.value))

/** The same split over the period before, when comparing its lines means something. */
const previousTotals = computed(() => {
  if (!range.value || state.value.by === 'month' || state.value.by === 'week') return null
  const before = applyFilters(entries.value, state.value.filters, shiftRange(range.value, -1), currency.value)
  return new Map(groupBy(before, state.value.by, state.value.filters.direction).map((bucket) => [bucket.key, bucket.total]))
})

const groupNames = computed(() =>
  Object.fromEntries((ledger.ledger?.groups ?? []).map((group) => [`${group.is_credit ? 'C' : 'D'}:${group.key}`, group.name])),
)

function amount(value: number): string {
  return privacyMode.value ? '•••' : formatCurrency(value, currency.value)
}

function patchState(patch: Partial<ExploreState>): void {
  state.value = { ...state.value, ...patch }
}

function update(patch: Partial<LedgerFilters>): void {
  filters.value = { ...filters.value, ...patch }
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list : [...list, value]
}

function selectBucket(bucket: Bucket): void {
  const f = filters.value
  switch (state.value.by) {
    case 'group':
      return update({ groups: toggle(f.groups, bucket.key) })
    case 'month':
      return update({ preset: 'custom', from: bucket.key, to: bucket.key })
    case 'account':
      return update({ accounts: toggle(f.accounts, bucket.key) })
    case 'means':
      return update({ means: toggle(f.means, bucket.key as OperationType) })
    case 'type':
      return update({ types: toggle(f.types, bucket.key as CashflowType) })
    case 'amount-band':
      return update(amountBandFilter(bucket.key))
  }
}

const views: Array<{ label: string; apply: Partial<LedgerFilters>; by: typeof state.value.by }> = [
  { label: "Où va l'argent", apply: { direction: 'out', types: ['EXPENSE'] }, by: 'group' },
  { label: "D'où vient l'argent", apply: { direction: 'in', types: ['INCOME'] }, by: 'group' },
  { label: 'Gros achats', apply: { direction: 'out', types: ['EXPENSE'], min: 200 }, by: 'group' },
  { label: 'Espèces', apply: { means: ['WITHDRAWAL'] }, by: 'month' },
  { label: 'À confirmer', apply: { onlyOpen: true }, by: 'group' },
]

function applyView(view: (typeof views)[number]): void {
  state.value = {
    ...state.value,
    by: view.by,
    filters: { ...DEFAULT_FILTERS, preset: filters.value.preset, from: filters.value.from, to: filters.value.to, ...view.apply },
  }
}

const stackOptions = [
  { label: 'Par type', value: 'type' },
  { label: 'Par contrepartie', value: 'group' },
]

// ── Actions ─────────────────────────────────────────────────

const notice = ref<string | null>(null)
const retyping = ref<BankTransactionItem | null>(null)

/** The shape the type picker reads, built from a ledger row. */
function asTransaction(entry: LedgerEntry): BankTransactionItem {
  return {
    id: entry.id,
    account_id: entry.account.id,
    account_name: entry.account.name,
    operation_date: entry.day || null,
    amount: entry.amount,
    currency: entry.currency,
    is_credit: entry.isCredit,
    is_pending: entry.isPending,
    label: entry.label || null,
    transfer_account_id: null,
    transfer_account_name: null,
    transfer_id: null,
    transfer_status: entry.transferStatus,
    operation_type: entry.operationType,
    cashflow_type: entry.cashflowType,
    type_source: entry.typeSource,
    type_rule_id: entry.typeRuleId,
    flow_question: null,
    // The ledger carries the type's source but not the deposit behind it: the
    // picker explains the deduction where the operation itself is listed.
    contribution: null,
    recurring: null,
    recurring_question: null,
  }
}

function onTyped(result: BankTransactionTypeResult): void {
  const count = result.covered_count
  notice.value = `${count} opération${count > 1 ? 's' : ''} comptée${count > 1 ? 's' : ''} en ${CASHFLOW_TYPE_LABELS[result.transaction.cashflow_type]}.`
}

function exportCsv(): void {
  const blob = new Blob([toCsv(selected.value)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = range.value ? `operations-${range.value.from}_${range.value.to}.csv` : 'operations.csv'
  link.click()
  URL.revokeObjectURL(url)
}

async function copyLink(): Promise<void> {
  try {
    await navigator.clipboard.writeText(window.location.href)
    notice.value = 'Lien copié : il rouvre cette sélection.'
  } catch {
    notice.value = "Impossible de copier le lien : copiez l'adresse de la page."
  }
}
</script>

<template>
  <div>
    <BaseAlert v-if="ledger.error" variant="danger" class="mb-6">
      {{ ledger.error }}
      <BaseButton size="sm" variant="outline" class="ml-3" @click="ledger.fetchLedger()">Réessayer</BaseButton>
    </BaseAlert>

    <div v-if="!ledger.ledger && !ledger.error" class="space-y-4">
      <BaseSkeleton variant="rect" width="100%" height="6rem" />
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <BaseSkeleton v-for="i in 4" :key="i" variant="rect" width="100%" height="5.5rem" />
      </div>
      <BaseSkeleton variant="rect" width="100%" height="18rem" />
    </div>

    <BaseEmptyState
      v-else-if="ledger.ledger && !entries.length"
      title="Aucune opération à explorer"
      description="Synchronisez une banque ou importez un relevé : l'Explorer lit vos opérations."
    >
      <template #icon><Landmark class="w-8 h-8 text-text-muted dark:text-text-dark-muted" /></template>
      <template #action>
        <router-link :to="{ name: 'bank' }"><BaseButton variant="outline">Aller à Banque</BaseButton></router-link>
      </template>
    </BaseEmptyState>

    <div v-else-if="ledger.ledger" class="space-y-6">
      <div class="-mx-1 px-1 flex items-center gap-2 overflow-x-auto pb-1">
        <Compass class="w-4 h-4 shrink-0 text-text-muted dark:text-text-dark-muted" />
        <button
          v-for="view in views"
          :key="view.label"
          type="button"
          class="shrink-0 px-3 py-1.5 rounded-full border border-surface-border dark:border-surface-dark-border text-xs sm:text-sm font-medium text-text-main dark:text-text-dark-main hover:border-primary/50 hover:text-primary whitespace-nowrap"
          @click="applyView(view)"
        >
          {{ view.label }}
        </button>
        <button type="button" class="shrink-0 px-2 text-xs font-medium text-text-muted dark:text-text-dark-muted hover:underline" @click="reset">
          Réinitialiser
        </button>
      </div>

      <BaseCard>
        <ExploreFilters v-model="filters" :accounts="ledger.ledger.accounts" :range="range" :group-names="groupNames" />
      </BaseCard>

      <BaseAlert v-if="notice" variant="success" dismissible @dismiss="notice = null">{{ notice }}</BaseAlert>

      <ExploreSummary
        :summary="summary"
        :months="months"
        :comparisons="comparisons"
        :direction="state.filters.direction"
        :currency="currency"
      />

      <BaseCard>
        <template #header>
          <div class="flex flex-wrap items-center justify-between gap-3">
            <h3 class="text-base font-semibold text-text-main dark:text-text-dark-main">Dans le temps</h3>
            <div class="flex flex-wrap items-center gap-3">
              <BaseSegmentedControl
                v-if="!state.cumulative"
                :model-value="state.stack"
                :options="stackOptions"
                size="sm"
                @update:model-value="(value) => patchState({ stack: value as ExploreState['stack'] })"
              />
              <label v-if="range" class="flex items-center gap-2 text-sm text-text-muted dark:text-text-dark-muted">
                <BaseToggle :model-value="state.cumulative" aria-label="Cumulé contre un an avant" @update:model-value="(value) => patchState({ cumulative: value })" />
                Cumulé vs un an avant
              </label>
            </div>
          </div>
        </template>
        <ExploreChart
          v-if="selected.length"
          :series="series"
          :cumulative="cumulative"
          :format="amount"
          :is-dark="isDark"
          @select-month="(period) => update({ preset: 'custom', from: period, to: period })"
        />
        <p v-else class="text-sm text-text-muted dark:text-text-dark-muted">Aucune opération dans cette sélection.</p>
      </BaseCard>

      <ExploreBreakdown
        :buckets="buckets"
        :previous="previousTotals"
        :by="state.by"
        :currency="currency"
        @update:by="(value) => patchState({ by: value })"
        @select="selectBucket"
      />

      <ExploreOperations
        :entries="selected"
        @retype="(entry) => (retyping = asTransaction(entry))"
        @export="exportCsv"
        @copy-link="copyLink"
      />

      <p class="text-xs text-text-muted dark:text-text-dark-muted">
        Montants en {{ currency }}. Hors virements entre vos comptes, annulations et opérations en attente,
        sauf si vous les incluez : les totaux sont alors ceux du Réel.
      </p>
    </div>

    <BankTypePicker :open="retyping !== null" :tx="retyping" @close="retyping = null" @saved="onTyped" />
  </div>
</template>
