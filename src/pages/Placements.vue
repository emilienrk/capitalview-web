<script setup lang="ts">
import { AlertTriangle, ChevronLeft, ChevronRight, Pencil, PiggyBank, RefreshCw } from 'lucide-vue-next'
import { computed, onMounted, reactive, ref, watch } from 'vue'

import type {
  PlacementAccountResponse,
  PlacementEntryResponse,
  PlacementEntryType,
  PlacementType,
} from '@/types'
import { usePlacementsStore } from '@/stores/placements'
import { useFormatters } from '@/composables/useFormatters'
import { usePrivacyMode } from '@/composables/usePrivacyMode'
import { useConfirm } from '@/composables/useConfirm'
import { useDarkMode } from '@/composables/useDarkMode'
import { useCarousel } from '@/composables/useCarousel'
import { useHistoryGranularity } from '@/composables/useHistoryGranularity'
import PageHeader from '@/components/PageHeader.vue'
import {
  BaseAddButton,
  BaseAlert,
  BaseBadge,
  BaseButton,
  BaseCard,
  BaseEmptyState,
  BaseInput,
  BaseModal,
  BaseSegmentedControl,
  BaseSelect,
  BaseSpinner,
  ChartPerformanceBadge,
} from '@/components'
import HistoryLineChart from '@/components/charts/HistoryLineChart.vue'
import AllocationDonutChart from '@/components/charts/AllocationDonutChart.vue'

const store = usePlacementsStore()
const { formatCurrency, formatPercent, formatDate, formatDateShort, profitLossClass } = useFormatters()
const { maskValue } = usePrivacyMode()
const { confirmDialog } = useConfirm()
const { isDark } = useDarkMode()

const PLACEMENT_LABELS: Record<PlacementType, string> = {
  AV: 'Assurance vie',
  PER: 'PER',
  EPARGNE_SALARIALE: 'Épargne salariale',
  SCPI: 'SCPI',
  CROWDFUNDING: 'Crowdfunding',
  CAPITALISATION: 'Contrat de capitalisation',
  OTHER: 'Autre',
}
const PLACEMENT_TYPES = Object.keys(PLACEMENT_LABELS) as PlacementType[]
const PLACEMENT_OPTIONS = PLACEMENT_TYPES.map((key) => ({
  label: key === 'EPARGNE_SALARIALE' ? 'Épargne salariale (PEE, PERCO, PER collectif)' : PLACEMENT_LABELS[key],
  value: key,
}))
const ENTRY_LABELS: Record<PlacementEntryType, string> = {
  VALUATION: 'Relevé de solde',
  DEPOSIT: 'Versement',
  WITHDRAW: 'Rachat',
}
const ENTRY_OPTIONS = (Object.keys(ENTRY_LABELS) as PlacementEntryType[]).map((key) => ({
  label: ENTRY_LABELS[key],
  value: key,
}))

const today = (): string => new Date().toISOString().slice(0, 10)

const placements = computed(() => store.summary?.accounts ?? [])

// ── Analysis card ───────────────────────────────────────────
type PlacementChartSlide = 'evolution' | 'allocation'
const {
  current: chartSlide,
  currentLabel: chartSlideLabel,
  next: nextChartSlide,
  prev: prevChartSlide,
  swipeHandlers: chartSwipe,
} = useCarousel<PlacementChartSlide>([
  { key: 'evolution', label: 'Évolution' },
  { key: 'allocation', label: 'Répartition par type' },
])
const {
  granularity: historyGranularity,
  granularityOptions,
  applyGranularity,
} = useHistoryGranularity(() => store.history)
const chartPerformance = ref<{ diff: number; percent: number | null } | null>(null)

const evolutionSeries = computed(() => {
  const history = applyGranularity(store.history)
  return history.length ? [{ name: 'Valeur totale', history }] : []
})

const analysisSubtitle = computed(() => {
  const summary = store.summary
  if (!summary) return 'Évolution et répartition par type'
  return `Valeur ${maskValue(formatCurrency(summary.total_value))} · versé net ${maskValue(formatCurrency(summary.net_invested))}`
})

const typeSegments = computed(() => {
  const byType = new Map<PlacementType, number>()
  for (const placement of placements.value) {
    byType.set(placement.placement_type, (byType.get(placement.placement_type) ?? 0) + Number(placement.current_value))
  }
  return [...byType.entries()]
    .map(([type, value]) => ({ name: PLACEMENT_LABELS[type], value }))
    .filter((segment) => segment.value > 0)
})

// ── Filter tabs ─────────────────────────────────────────────
const activeFilter = ref<'all' | PlacementType>('all')
const presentTypes = computed(() =>
  PLACEMENT_TYPES.filter((type) => placements.value.some((p) => p.placement_type === type)),
)
const filterTabs = computed(() => [
  { key: 'all' as const, label: 'Tous' },
  ...presentTypes.value.map((type) => ({ key: type, label: PLACEMENT_LABELS[type] })),
])
const filteredPlacements = computed(() =>
  activeFilter.value === 'all'
    ? placements.value
    : placements.value.filter((p) => p.placement_type === activeFilter.value),
)
// The last placement of a type deleted or retyped takes its tab away.
watch(presentTypes, (types) => {
  if (activeFilter.value !== 'all' && !types.includes(activeFilter.value)) activeFilter.value = 'all'
})

// ── Placement modal ─────────────────────────────────────────
const selectedId = ref<string | null>(null)
const showPlacementModal = ref(false)
const editingPlacementId = ref<string | null>(null)
const placementError = ref<string | null>(null)
const placementForm = reactive({
  name: '',
  placement_type: 'AV' as PlacementType,
  institution_name: '',
  opened_at: '',
  // Entered as a percentage, sent as a decimal like every rate the API takes.
  expected_rate_pct: '' as string | number,
})

function openCreatePlacement(): void {
  editingPlacementId.value = null
  placementError.value = null
  Object.assign(placementForm, {
    name: '',
    placement_type: activeFilter.value === 'all' ? 'AV' : activeFilter.value,
    institution_name: '',
    opened_at: '',
    expected_rate_pct: '',
  })
  showPlacementModal.value = true
}

function openEditPlacement(placement: PlacementAccountResponse): void {
  editingPlacementId.value = placement.id
  placementError.value = null
  Object.assign(placementForm, {
    name: placement.name,
    placement_type: placement.placement_type,
    institution_name: placement.institution_name ?? '',
    opened_at: placement.opened_at ?? '',
    expected_rate_pct:
      placement.expected_return_rate !== null ? Number(placement.expected_return_rate) * 100 : '',
  })
  showPlacementModal.value = true
}

async function savePlacement(): Promise<void> {
  if (!placementForm.name.trim()) {
    placementError.value = 'Le nom est requis'
    return
  }
  const payload = {
    name: placementForm.name.trim(),
    placement_type: placementForm.placement_type,
    institution_name: placementForm.institution_name.trim() || null,
    opened_at: placementForm.opened_at || null,
    expected_return_rate:
      placementForm.expected_rate_pct === '' ? null : Number(placementForm.expected_rate_pct) / 100,
  }
  const saved = editingPlacementId.value
    ? await store.updatePlacement(editingPlacementId.value, payload)
    : await store.createPlacement(payload)
  if (!saved) {
    placementError.value = store.error
    return
  }
  showPlacementModal.value = false
}

async function removePlacement(placement: PlacementAccountResponse): Promise<void> {
  const ok = await confirmDialog({
    title: 'Supprimer le placement',
    message: `Supprimer « ${placement.name} » et toutes ses opérations ?`,
    confirmLabel: 'Supprimer',
  })
  if (!ok) return
  if (await store.deletePlacement(placement.id)) {
    showPlacementModal.value = false
    if (selectedId.value === placement.id) selectedId.value = null
  }
}

// ── Entries ─────────────────────────────────────────────────
const entriesLoading = ref(false)
const showEntryModal = ref(false)
const entryAccountId = ref<string | null>(null)
const editingEntryId = ref<string | null>(null)
const entryError = ref<string | null>(null)
const entryForm = reactive({
  type: 'DEPOSIT' as PlacementEntryType,
  amount: '' as string | number,
  occurred_at: today(),
  note: '',
})

const selectedEntries = computed<PlacementEntryResponse[]>(() =>
  selectedId.value ? store.entriesByAccount[selectedId.value] ?? [] : [],
)
// A balance needs a deposit on or before it: warn before the API refuses.
const modalHasDeposit = computed(() =>
  (entryAccountId.value ? store.entriesByAccount[entryAccountId.value] ?? [] : []).some(
    (entry) => entry.type === 'DEPOSIT',
  ),
)

async function togglePlacement(id: string): Promise<void> {
  if (selectedId.value === id) {
    selectedId.value = null
    return
  }
  selectedId.value = id
  entriesLoading.value = true
  await store.fetchEntries(id)
  entriesLoading.value = false
}

async function openAddEntry(placementId: string): Promise<void> {
  entryAccountId.value = placementId
  editingEntryId.value = null
  entryError.value = null
  Object.assign(entryForm, { type: 'DEPOSIT', amount: '', occurred_at: today(), note: '' })
  showEntryModal.value = true
  if (!store.entriesByAccount[placementId]) await store.fetchEntries(placementId)
}

function openEditEntry(entry: PlacementEntryResponse): void {
  entryAccountId.value = entry.account_id
  editingEntryId.value = entry.id
  entryError.value = null
  Object.assign(entryForm, {
    type: entry.type,
    amount: Number(entry.amount),
    occurred_at: entry.occurred_at,
    note: entry.note ?? '',
  })
  showEntryModal.value = true
}

async function submitEntry(): Promise<void> {
  if (!entryAccountId.value || entryForm.amount === '') return
  entryError.value = null
  const common = {
    amount: Number(entryForm.amount),
    occurred_at: entryForm.occurred_at,
    note: entryForm.note.trim() || null,
  }
  const ok = editingEntryId.value
    ? await store.updateEntry(entryAccountId.value, editingEntryId.value, common)
    : await store.addEntry(entryAccountId.value, { type: entryForm.type, ...common })
  if (!ok) {
    entryError.value = store.error
    return
  }
  showEntryModal.value = false
}

async function removeEntry(): Promise<void> {
  if (!entryAccountId.value || !editingEntryId.value) return
  const ok = await confirmDialog({
    title: "Supprimer l'opération",
    message: `Supprimer ce ${ENTRY_LABELS[entryForm.type].toLowerCase()} du ${formatDate(entryForm.occurred_at)} ?`,
    confirmLabel: 'Supprimer',
  })
  if (!ok) return
  if (await store.deleteEntry(entryAccountId.value, editingEntryId.value)) {
    showEntryModal.value = false
  } else {
    entryError.value = store.error
  }
}

function entryBadge(type: PlacementEntryType): 'info' | 'success' | 'danger' {
  if (type === 'VALUATION') return 'info'
  return type === 'DEPOSIT' ? 'success' : 'danger'
}

function signedAmount(entry: PlacementEntryResponse): string {
  const formatted = formatCurrency(entry.amount)
  if (entry.type === 'DEPOSIT') return `+${formatted}`
  if (entry.type === 'WITHDRAW') return `−${formatted}`
  return formatted
}

function staleMessage(placement: PlacementAccountResponse): string {
  if (placement.days_since_valuation === null) {
    return 'Aucun relevé saisi : la valeur affichée est ce que vous avez versé, sans les gains.'
  }
  return `Dernier relevé il y a ${placement.days_since_valuation} jours : saisissez le solde de votre espace client.`
}

function taxLine(placement: PlacementAccountResponse): string | null {
  if (!placement.tax_anniversary_date) return null
  const reached = placement.tax_anniversary_date <= today()
  return reached
    ? `Plus de 8 ans depuis le ${formatDate(placement.tax_anniversary_date)}`
    : `8 ans le ${formatDate(placement.tax_anniversary_date)}`
}

onMounted(async () => {
  await store.fetchPlacements()
  // The chart has its own loading state: the list does not wait for it.
  void store.fetchHistory()
})
</script>

<template>
  <div>
    <PageHeader title="Placements" description="AV, PER, épargne salariale, SCPI… suivis sur relevés">
      <template #actions>
        <BaseAddButton size="sm" @click="openCreatePlacement">Nouveau placement</BaseAddButton>
      </template>
    </PageHeader>

    <div v-if="store.isLoading && !store.summary" class="flex justify-center py-20">
      <BaseSpinner size="lg" label="Chargement..." />
    </div>

    <BaseAlert v-if="store.error && !showPlacementModal && !showEntryModal" variant="danger" dismissible class="mb-6" @dismiss="store.error = null">
      {{ store.error }}
    </BaseAlert>

    <BaseCard v-if="placements.length" title="Analyse des placements" :subtitle="analysisSubtitle" class="mb-6">
      <div class="mb-3 flex items-center justify-between gap-2">
        <div class="flex items-center gap-1 min-w-0">
          <BaseButton icon size="sm" variant="ghost" class="shrink-0" @click="prevChartSlide">
            <ChevronLeft class="w-4 h-4" />
          </BaseButton>
          <p class="text-xs font-medium text-text-main dark:text-text-dark-main truncate">
            {{ chartSlideLabel }}
          </p>
          <BaseButton icon size="sm" variant="ghost" class="shrink-0" @click="nextChartSlide">
            <ChevronRight class="w-4 h-4" />
          </BaseButton>
        </div>
        <ChartPerformanceBadge v-if="chartSlide === 'evolution'" :performance="chartPerformance" />
      </div>

      <div
        class="min-h-[340px]"
        @touchstart.passive="chartSwipe.onTouchStart"
        @touchend.passive="chartSwipe.onTouchEnd"
      >
        <template v-if="chartSlide === 'evolution'">
          <div v-if="store.historyLoading && !store.history.length" class="h-72 flex items-center justify-center">
            <BaseSpinner size="md" label="Chargement de l'historique..." />
          </div>
          <HistoryLineChart
            v-else-if="evolutionSeries.length"
            :series="evolutionSeries"
            :is-dark="isDark"
            :granularity="historyGranularity"
            show-performance
            @update:performance="chartPerformance = $event"
          >
            <template #leading>
              <BaseButton icon size="sm" variant="outline" @click="store.fetchHistory()">
                <RefreshCw class="w-4 h-4" />
              </BaseButton>
              <BaseSegmentedControl v-model="historyGranularity" :options="granularityOptions" variant="primary" size="sm" />
            </template>
          </HistoryLineChart>
          <BaseEmptyState
            v-else
            title="Pas encore de données historiques"
            description="L'évolution s'affichera dès qu'une opération aura été saisie"
          />
        </template>

        <template v-else-if="chartSlide === 'allocation'">
          <AllocationDonutChart v-if="typeSegments.length" :segments="typeSegments" :is-dark="isDark" reserve-top-space />
          <BaseEmptyState
            v-else
            title="Pas de répartition disponible"
            description="Saisissez un versement ou un relevé pour voir la répartition par type"
          />
        </template>
      </div>
    </BaseCard>

    <!-- ── Filter tabs ──────────────────────────────────── -->
    <div v-if="placements.length" class="mb-6 border-b border-surface-border dark:border-surface-dark-border">
      <div class="flex gap-6 overflow-x-auto">
        <button
          v-for="tab in filterTabs"
          :key="tab.key"
          :class="[
            'pb-3 text-sm font-medium whitespace-nowrap transition-all duration-150 border-b-2',
            activeFilter === tab.key
              ? 'border-primary text-primary'
              : 'border-transparent text-text-muted dark:text-text-dark-muted hover:text-text-main dark:hover:text-text-dark-main hover:border-surface-border dark:hover:border-surface-dark-border',
          ]"
          @click="activeFilter = tab.key"
        >
          {{ tab.label }}
        </button>
      </div>
    </div>

    <!-- ── Placement list ───────────────────────────────── -->
    <div v-if="filteredPlacements.length" class="space-y-4">
      <BaseCard
        v-for="placement in filteredPlacements"
        :key="placement.id"
        :class="[
          'transition-all duration-150',
          selectedId === placement.id ? 'ring-2 ring-primary ring-offset-2 dark:ring-offset-background-dark' : '',
        ]"
      >
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex-1 min-w-0 cursor-pointer" @click="togglePlacement(placement.id)">
            <div class="flex items-center gap-3">
              <h3 class="font-semibold text-text-main dark:text-text-dark-main truncate">{{ placement.name }}</h3>
              <BaseBadge :variant="placement.placement_type === 'AV' ? 'primary' : 'secondary'">
                {{ PLACEMENT_LABELS[placement.placement_type] }}
              </BaseBadge>
            </div>
            <div class="flex flex-wrap items-center gap-x-3 mt-1 text-xs text-text-muted dark:text-text-dark-muted">
              <span v-if="placement.institution_name">{{ placement.institution_name }}</span>
              <span v-if="taxLine(placement)">{{ taxLine(placement) }}</span>
            </div>
          </div>
          <div class="flex items-center gap-2 shrink-0 self-start">
            <BaseAddButton variant="ghost" size="sm" @click.stop="openAddEntry(placement.id)">Opération</BaseAddButton>
            <BaseButton size="sm" variant="ghost" :aria-label="`Modifier le placement ${placement.name}`" @click.stop="openEditPlacement(placement)">
              <Pencil class="w-4 h-4" />
            </BaseButton>
          </div>
        </div>

        <div class="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3 cursor-pointer" @click="togglePlacement(placement.id)">
          <div class="rounded-secondary bg-background-subtle dark:bg-background-dark-subtle border border-surface-border dark:border-surface-dark-border p-3.5">
            <p class="text-[11px] font-medium uppercase tracking-wider text-text-muted dark:text-text-dark-muted mb-1">Valeur</p>
            <p class="text-lg font-bold tabular-nums text-text-main dark:text-text-dark-main">
              {{ maskValue(formatCurrency(placement.current_value)) }}
            </p>
          </div>
          <div class="rounded-secondary bg-background-subtle dark:bg-background-dark-subtle border border-surface-border dark:border-surface-dark-border p-3.5">
            <p class="text-[11px] font-medium uppercase tracking-wider text-text-muted dark:text-text-dark-muted mb-1">Versé net</p>
            <p class="text-lg font-bold tabular-nums text-text-main dark:text-text-dark-main">
              {{ maskValue(formatCurrency(placement.net_invested)) }}
            </p>
          </div>
          <div class="rounded-secondary bg-background-subtle dark:bg-background-dark-subtle border border-surface-border dark:border-surface-dark-border p-3.5">
            <p class="text-[11px] font-medium uppercase tracking-wider text-text-muted dark:text-text-dark-muted mb-1">Plus-value</p>
            <p :class="['text-lg font-bold tabular-nums', placement.gain !== null ? profitLossClass(placement.gain) : 'text-text-muted dark:text-text-dark-muted']">
              {{ placement.gain !== null ? maskValue(formatCurrency(placement.gain)) : '—' }}
            </p>
            <p v-if="placement.gain_percentage !== null" :class="['text-xs tabular-nums', profitLossClass(placement.gain_percentage)]">
              {{ formatPercent(placement.gain_percentage) }}
            </p>
          </div>
          <div class="rounded-secondary bg-background-subtle dark:bg-background-dark-subtle border border-surface-border dark:border-surface-dark-border p-3.5">
            <p class="text-[11px] font-medium uppercase tracking-wider text-text-muted dark:text-text-dark-muted mb-1">Rendement annuel</p>
            <p :class="['text-lg font-bold tabular-nums', placement.annual_return_rate !== null ? profitLossClass(placement.annual_return_rate) : 'text-text-muted dark:text-text-dark-muted']">
              {{ placement.annual_return_rate !== null ? formatPercent(Number(placement.annual_return_rate) * 100) : '—' }}
            </p>
            <p v-if="placement.annual_return_rate === null" class="text-xs text-text-muted dark:text-text-dark-muted">
              Il faut un an de relevés
            </p>
          </div>
        </div>

        <p v-if="placement.is_stale" class="mt-3 flex items-start gap-2 text-xs text-warning">
          <AlertTriangle class="w-4 h-4 shrink-0" />
          <span>{{ staleMessage(placement) }}</span>
        </p>
        <p v-else-if="placement.last_valuation_date" class="mt-3 text-xs text-text-muted dark:text-text-dark-muted">
          Valeur au dernier relevé du {{ formatDate(placement.last_valuation_date) }}, versements et rachats suivants inclus.
        </p>

        <!-- Detail: the operations, laid out like the stock history tab -->
        <div
          v-if="selectedId === placement.id"
          class="mt-6 pt-6 border-t border-surface-border dark:border-surface-dark-border"
        >
          <div v-if="entriesLoading" class="flex justify-center py-8">
            <BaseSpinner size="md" />
          </div>
          <template v-else-if="selectedEntries.length">
            <div class="hidden md:block overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="text-left text-xs text-text-muted dark:text-text-dark-muted uppercase tracking-wider border-b border-surface-border dark:border-surface-dark-border">
                    <th class="px-4 py-2">Date</th>
                    <th class="px-4 py-2">Type</th>
                    <th class="px-4 py-2">Note</th>
                    <th class="px-4 py-2 text-right">Montant</th>
                    <th class="px-4 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-surface-border dark:divide-surface-dark-border">
                  <tr v-for="entry in selectedEntries" :key="entry.id" class="transition-colors hover:bg-surface-hover dark:hover:bg-surface-dark-hover">
                    <td class="px-4 py-2.5 text-text-muted dark:text-text-dark-muted">{{ formatDateShort(entry.occurred_at) }}</td>
                    <td class="px-4 py-2.5">
                      <BaseBadge :variant="entryBadge(entry.type)">{{ ENTRY_LABELS[entry.type] }}</BaseBadge>
                    </td>
                    <td class="px-4 py-2.5 text-text-muted dark:text-text-dark-muted text-xs">{{ entry.note || '—' }}</td>
                    <td class="px-4 py-2.5 text-right font-medium">{{ maskValue(signedAmount(entry)) }}</td>
                    <td class="px-4 py-2.5 text-right">
                      <BaseButton size="sm" variant="ghost" :aria-label="`Modifier l'opération du ${formatDateShort(entry.occurred_at)}`" @click="openEditEntry(entry)">
                        <Pencil class="w-4 h-4" />
                      </BaseButton>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="md:hidden space-y-2">
              <div
                v-for="entry in selectedEntries"
                :key="entry.id"
                class="rounded-secondary p-3 border border-surface-border dark:border-surface-dark-border"
              >
                <div class="flex items-center justify-between gap-2 mb-1.5">
                  <BaseBadge :variant="entryBadge(entry.type)">{{ ENTRY_LABELS[entry.type] }}</BaseBadge>
                  <span class="text-sm font-semibold text-text-main dark:text-text-dark-main whitespace-nowrap">
                    {{ maskValue(signedAmount(entry)) }}
                  </span>
                </div>
                <div class="flex items-center justify-between gap-2 text-xs text-text-muted dark:text-text-dark-muted">
                  <span class="truncate">
                    {{ formatDateShort(entry.occurred_at) }}<span v-if="entry.note"> — {{ entry.note }}</span>
                  </span>
                  <BaseButton size="sm" variant="ghost" :aria-label="`Modifier l'opération du ${formatDateShort(entry.occurred_at)}`" @click="openEditEntry(entry)">
                    <Pencil class="w-4 h-4" />
                  </BaseButton>
                </div>
              </div>
            </div>
          </template>
          <BaseEmptyState
            v-else
            title="Aucune opération"
            description="Commencez par vos versements, puis le solde de votre dernier relevé."
          />
        </div>
      </BaseCard>
    </div>

    <!-- Empty state -->
    <BaseEmptyState
      v-else-if="!store.isLoading && !placements.length"
      title="Aucun placement"
      description="Ajoutez un placement (AV, PER, SCPI, épargne salariale…), puis saisissez vos versements et les soldes lus sur vos relevés."
      action-label="Créer un placement"
      @action="openCreatePlacement"
    >
      <template #icon>
        <PiggyBank class="w-8 h-8 text-text-muted dark:text-text-dark-muted" />
      </template>
    </BaseEmptyState>

    <!-- ── Entry modal ──────────────────────────────────── -->
    <BaseModal
      :open="showEntryModal"
      :title="editingEntryId ? 'Modifier l\'opération' : 'Nouvelle opération'"
      @close="showEntryModal = false"
    >
      <BaseAlert v-if="entryError" variant="danger" dismissible class="mb-4" @dismiss="entryError = null">
        {{ entryError }}
      </BaseAlert>
      <form class="space-y-4" @submit.prevent="submitEntry">
        <div>
          <BaseSelect
            v-model="entryForm.type"
            label="Type d'opération"
            :options="ENTRY_OPTIONS"
            :disabled="!!editingEntryId"
          />
          <p v-if="editingEntryId" class="mt-1 text-xs text-text-muted dark:text-text-dark-muted">
            Le type d'une opération est fixé à sa création.
          </p>
        </div>
        <BaseInput
          v-model="entryForm.amount"
          :label="entryForm.type === 'VALUATION' ? 'Solde lu' : 'Montant'"
          type="number"
          step="any"
          min="0"
          placeholder="0.00"
          required
        />
        <p v-if="entryForm.type === 'VALUATION' && !modalHasDeposit" class="-mt-2 text-xs text-warning">
          Saisissez d'abord vos versements : un relevé doit en avoir au moins un à sa date ou avant.
          Si vous n'en connaissez pas le détail, saisissez le total versé à ce jour en un seul versement,
          à la date d'ouverture.
        </p>
        <p v-else-if="entryForm.type === 'VALUATION'" class="-mt-2 text-xs text-text-muted dark:text-text-dark-muted">
          La valeur totale du placement à cette date, telle qu'affichée sur votre relevé ou votre espace client.
        </p>
        <BaseInput v-model="entryForm.occurred_at" label="Date" type="date" required />
        <BaseInput v-model="entryForm.note" label="Note" placeholder="Optionnel" />
      </form>
      <template #footer>
        <div class="flex justify-between w-full">
          <BaseButton v-if="editingEntryId" variant="danger" @click="removeEntry">Supprimer</BaseButton>
          <div v-else></div>
          <div class="flex gap-2">
            <BaseButton variant="ghost" @click="showEntryModal = false">Annuler</BaseButton>
            <BaseButton :disabled="entryForm.amount === ''" @click="submitEntry">
              {{ editingEntryId ? 'Enregistrer' : 'Valider' }}
            </BaseButton>
          </div>
        </div>
      </template>
    </BaseModal>

    <!-- ── Placement modal ──────────────────────────────── -->
    <BaseModal
      :open="showPlacementModal"
      :title="editingPlacementId ? 'Modifier le placement' : 'Nouveau placement'"
      @close="showPlacementModal = false"
    >
      <BaseAlert v-if="placementError" variant="danger" dismissible class="mb-4" @dismiss="placementError = null">
        {{ placementError }}
      </BaseAlert>
      <div class="space-y-4">
        <BaseInput v-model="placementForm.name" label="Nom" placeholder="Ex. Linxea Spirit 2, SCPI Corum Origin" required />
        <BaseSelect
          :model-value="placementForm.placement_type"
          label="Type de placement"
          :options="PLACEMENT_OPTIONS"
          @update:model-value="placementForm.placement_type = ($event as PlacementType) ?? 'AV'"
        />
        <BaseInput v-model="placementForm.institution_name" label="Établissement" placeholder="Optionnel" />
        <BaseInput v-model="placementForm.opened_at" label="Date d'ouverture" type="date" />
        <p v-if="placementForm.placement_type === 'AV'" class="-mt-2 text-xs text-text-muted dark:text-text-dark-muted">
          Sert à dater les 8 ans de l'avantage fiscal. À défaut, la date du premier versement est utilisée.
        </p>
        <BaseInput
          v-model="placementForm.expected_rate_pct"
          label="Rendement annuel attendu (%)"
          type="number"
          placeholder="Optionnel, ex. 3"
        />
        <p class="-mt-2 text-xs text-text-muted dark:text-text-dark-muted">
          N'entre que dans la projection, et seulement tant qu'un an de relevés ne permet pas de mesurer le rendement réel.
        </p>
      </div>
      <template #footer>
        <div class="flex justify-between w-full">
          <BaseButton
            v-if="editingPlacementId"
            variant="danger"
            @click="removePlacement(placements.find((p) => p.id === editingPlacementId)!)"
          >
            Supprimer
          </BaseButton>
          <div v-else></div>
          <div class="flex gap-2">
            <BaseButton variant="ghost" @click="showPlacementModal = false">Annuler</BaseButton>
            <BaseButton @click="savePlacement">{{ editingPlacementId ? 'Enregistrer' : 'Créer' }}</BaseButton>
          </div>
        </div>
      </template>
    </BaseModal>
  </div>
</template>
