<script setup lang="ts">
/**
 * The Explorer's filters: the period always in sight, the rest folded behind
 * one button on a phone. Every change replaces the whole filter object, so the
 * page's URL follows it.
 */
import { computed, ref, watch } from 'vue'
import { ChevronLeft, ChevronRight, Search, SlidersHorizontal, X } from 'lucide-vue-next'

import { BaseButton, BaseSegmentedControl, BaseSelect, BaseToggle } from '@/components'
import { CASHFLOW_TYPES, CASHFLOW_TYPE_LABELS, OPERATION_TYPE_LABELS } from '@/utils/cashflowTypes'
import {
  DEFAULT_FILTERS, monthLabel, shiftRange, toPeriod, type LedgerFilters, type PeriodPreset, type PeriodRange,
} from '@/utils/ledger'
import type { BankLedgerAccount, CashflowType, OperationType } from '@/types'

const filters = defineModel<LedgerFilters>({ required: true })

const props = defineProps<{
  accounts: BankLedgerAccount[]
  range: PeriodRange | null
  /** Names of the counterparts a filter holds, by group id. */
  groupNames: Record<string, string>
}>()

function update(patch: Partial<LedgerFilters>): void {
  filters.value = { ...filters.value, ...patch }
}

const presets: Array<{ label: string; value: PeriodPreset }> = [
  { label: 'Ce mois', value: 'month' },
  { label: 'Mois dernier', value: 'last-month' },
  { label: '3 mois', value: '3m' },
  { label: '12 mois', value: '12m' },
  { label: 'Cette année', value: 'ytd' },
  { label: 'Année dernière', value: 'last-year' },
  { label: 'Tout', value: 'all' },
]

function choosePreset(value: string | number): void {
  update({ preset: value as PeriodPreset, from: null, to: null })
}

/** Moving the period keeps its length, as a custom range. */
function move(lengths: number): void {
  if (!props.range) return
  const next = shiftRange(props.range, lengths)
  update({ preset: 'custom', from: next.from, to: next.to })
}

const canMoveForward = computed(() => props.range !== null && props.range.to < toPeriod(new Date()))

function setBound(bound: 'from' | 'to', value: string): void {
  if (!/^\d{4}-\d{2}$/.test(value)) return
  const other = bound === 'from' ? (props.range?.to ?? value) : (props.range?.from ?? value)
  update(bound === 'from' ? { preset: 'custom', from: value, to: other } : { preset: 'custom', from: other, to: value })
}

// The search is typed into a local value and written after a pause: the URL
// and every figure follow the filter, and need not follow each keystroke.
const query = ref(filters.value.query)
let timer: ReturnType<typeof setTimeout> | undefined
watch(query, (value) => {
  clearTimeout(timer)
  timer = setTimeout(() => update({ query: value }), 150)
})
watch(() => filters.value.query, (value) => {
  if (value !== query.value) query.value = value
})

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
}

const meansOptions = computed(() => [
  ...Object.entries(OPERATION_TYPE_LABELS).map(([value, label]) => ({ value: value as OperationType, label })),
  { value: 'UNKNOWN' as OperationType, label: 'Non précisé' },
])

const directionOptions = [
  { label: 'Entrées et sorties', value: 'all' },
  { label: 'Sorties', value: 'out' },
  { label: 'Entrées', value: 'in' },
]

function readAmount(event: Event): number | null {
  const raw = (event.target as HTMLInputElement).value.replace(',', '.')
  if (raw.trim() === '') return null
  const value = Number(raw)
  return Number.isFinite(value) && value >= 0 ? value : null
}

/** Everything set beyond the period, as removable chips. */
const active = computed(() => {
  const f = filters.value
  const chips: Array<{ key: string; label: string; clear: Partial<LedgerFilters> }> = []
  for (const id of f.accounts) {
    chips.push({ key: `acc:${id}`, label: props.accounts.find((a) => a.id === id)?.name ?? 'Compte', clear: { accounts: f.accounts.filter((a) => a !== id) } })
  }
  if (f.direction !== 'all') chips.push({ key: 'dir', label: f.direction === 'out' ? 'Sorties' : 'Entrées', clear: { direction: 'all' } })
  for (const type of f.types) chips.push({ key: `type:${type}`, label: CASHFLOW_TYPE_LABELS[type], clear: { types: f.types.filter((t) => t !== type) } })
  for (const means of f.means) {
    chips.push({ key: `means:${means}`, label: meansOptions.value.find((m) => m.value === means)?.label ?? means, clear: { means: f.means.filter((m) => m !== means) } })
  }
  for (const id of f.groups) chips.push({ key: `group:${id}`, label: props.groupNames[id] ?? id.slice(2), clear: { groups: f.groups.filter((g) => g !== id) } })
  if (f.min !== null) chips.push({ key: 'min', label: `≥ ${f.min} €`, clear: { min: null } })
  if (f.max !== null) chips.push({ key: 'max', label: `≤ ${f.max} €`, clear: { max: null } })
  if (f.query.trim()) chips.push({ key: 'q', label: `« ${f.query.trim()} »`, clear: { query: '' } })
  if (f.onlyOpen) chips.push({ key: 'open', label: 'À confirmer', clear: { onlyOpen: false } })
  if (f.includePending) chips.push({ key: 'pending', label: 'Avec en attente', clear: { includePending: false } })
  if (f.includeUncounted) chips.push({ key: 'all', label: 'Avec virements internes', clear: { includeUncounted: false } })
  return chips
})

function clearAll(): void {
  query.value = ''
  filters.value = { ...DEFAULT_FILTERS, preset: filters.value.preset, from: filters.value.from, to: filters.value.to }
}

const open = ref(false)
const chip = (on: boolean) => [
  'shrink-0 px-3 py-1.5 rounded-button text-xs sm:text-sm font-medium transition-colors whitespace-nowrap',
  on
    ? 'bg-primary text-primary-content'
    : 'bg-background-subtle dark:bg-background-dark-subtle text-text-muted dark:text-text-dark-muted hover:text-text-main dark:hover:text-text-dark-main',
]
</script>

<template>
  <div class="space-y-3">
    <div class="flex flex-col xl:flex-row xl:items-center gap-3">
      <div class="-mx-1 px-1 overflow-x-auto shrink-0">
        <!-- Its own width, scrolled on a phone: squeezed, each label broke over two lines. -->
        <div class="w-max whitespace-nowrap">
          <BaseSegmentedControl :model-value="filters.preset" :options="presets" size="sm" @update:model-value="choosePreset" />
        </div>
      </div>
      <div class="grid grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto] xl:flex items-center gap-1">
        <BaseButton icon size="sm" variant="ghost" aria-label="Période précédente" :disabled="!range" @click="move(-1)">
          <ChevronLeft class="w-4 h-4" />
        </BaseButton>
        <input
          type="month"
          aria-label="Début"
          :value="range?.from ?? ''"
          class="w-full xl:w-40 min-w-0 px-2 py-1.5 rounded-input border border-surface-border dark:border-surface-dark-border bg-surface dark:bg-surface-dark text-sm text-text-main dark:text-text-dark-main"
          @change="setBound('from', ($event.target as HTMLInputElement).value)"
        />
        <span class="text-text-muted dark:text-text-dark-muted">→</span>
        <input
          type="month"
          aria-label="Fin"
          :value="range?.to ?? ''"
          class="w-full xl:w-40 min-w-0 px-2 py-1.5 rounded-input border border-surface-border dark:border-surface-dark-border bg-surface dark:bg-surface-dark text-sm text-text-main dark:text-text-dark-main"
          @change="setBound('to', ($event.target as HTMLInputElement).value)"
        />
        <BaseButton icon size="sm" variant="ghost" aria-label="Période suivante" :disabled="!canMoveForward" @click="move(1)">
          <ChevronRight class="w-4 h-4" />
        </BaseButton>
      </div>
    </div>
    <p v-if="range" class="-mt-1 text-xs text-text-muted dark:text-text-dark-muted capitalize">
      {{ range.from === range.to ? monthLabel(range.from, 'long') : `${monthLabel(range.from, 'long')} – ${monthLabel(range.to, 'long')}` }}
    </p>

    <div class="flex items-center gap-2">
      <div class="relative flex-1">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted dark:text-text-dark-muted" />
        <input
          v-model="query"
          type="search"
          placeholder="Libellé, contrepartie, compte… (-mot pour exclure)"
          aria-label="Rechercher"
          class="w-full pl-10 pr-4 py-2.5 rounded-input border border-surface-border dark:border-surface-dark-border bg-surface dark:bg-surface-dark text-text-main dark:text-text-dark-main placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
        />
      </div>
      <BaseButton variant="outline" size="sm" class="lg:hidden shrink-0" :aria-expanded="open" @click="open = !open">
        <SlidersHorizontal class="w-4 h-4 mr-1.5" /> Filtres<template v-if="active.length"> ({{ active.length }})</template>
      </BaseButton>
    </div>

    <div :class="['space-y-3', open ? 'block' : 'hidden lg:block']">
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <div>
          <p class="mb-1.5 text-xs font-medium text-text-muted dark:text-text-dark-muted">Comptes</p>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="account in accounts"
              :key="account.id"
              type="button"
              :aria-pressed="filters.accounts.includes(account.id)"
              :class="chip(filters.accounts.includes(account.id))"
              @click="update({ accounts: toggle(filters.accounts, account.id) })"
            >
              {{ account.name }}
            </button>
          </div>
        </div>
        <div>
          <p class="mb-1.5 text-xs font-medium text-text-muted dark:text-text-dark-muted">Types</p>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="type in CASHFLOW_TYPES"
              :key="type"
              type="button"
              :aria-pressed="filters.types.includes(type)"
              :class="chip(filters.types.includes(type))"
              @click="update({ types: toggle<CashflowType>(filters.types, type) })"
            >
              {{ CASHFLOW_TYPE_LABELS[type] }}
            </button>
          </div>
        </div>
        <div>
          <p class="mb-1.5 text-xs font-medium text-text-muted dark:text-text-dark-muted">Moyens de paiement</p>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="means in meansOptions"
              :key="means.value"
              type="button"
              :aria-pressed="filters.means.includes(means.value)"
              :class="chip(filters.means.includes(means.value))"
              @click="update({ means: toggle<OperationType>(filters.means, means.value) })"
            >
              {{ means.label }}
            </button>
          </div>
        </div>
        <div class="space-y-2">
          <BaseSelect
            :model-value="filters.direction"
            :options="directionOptions"
            aria-label="Sens"
            @update:model-value="(value) => update({ direction: (value ?? 'all') as LedgerFilters['direction'] })"
          />
          <div class="flex items-center gap-2">
            <input
              type="text"
              inputmode="decimal"
              placeholder="Min €"
              aria-label="Montant minimum"
              :value="filters.min ?? ''"
              class="w-full px-3 py-2 rounded-input border border-surface-border dark:border-surface-dark-border bg-surface dark:bg-surface-dark text-sm text-text-main dark:text-text-dark-main"
              @change="update({ min: readAmount($event) })"
            />
            <input
              type="text"
              inputmode="decimal"
              placeholder="Max €"
              aria-label="Montant maximum"
              :value="filters.max ?? ''"
              class="w-full px-3 py-2 rounded-input border border-surface-border dark:border-surface-dark-border bg-surface dark:bg-surface-dark text-sm text-text-main dark:text-text-dark-main"
              @change="update({ max: readAmount($event) })"
            />
          </div>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-text-muted dark:text-text-dark-muted">
        <label class="flex items-center gap-2">
          <BaseToggle :model-value="filters.onlyOpen" aria-label="Seulement à confirmer" @update:model-value="update({ onlyOpen: $event })" />
          Seulement à confirmer
        </label>
        <label class="flex items-center gap-2">
          <BaseToggle :model-value="filters.includePending" aria-label="Inclure en attente" @update:model-value="update({ includePending: $event })" />
          Inclure en attente
        </label>
        <label class="flex items-center gap-2">
          <BaseToggle :model-value="filters.includeUncounted" aria-label="Inclure les virements internes" @update:model-value="update({ includeUncounted: $event })" />
          Inclure virements internes et annulations
        </label>
      </div>
    </div>

    <div v-if="active.length" class="flex flex-wrap items-center gap-1.5">
      <button
        v-for="item in active"
        :key="item.key"
        type="button"
        class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20"
        :aria-label="`Retirer le filtre ${item.label}`"
        @click="update(item.clear); if (item.key === 'q') query = ''"
      >
        {{ item.label }} <X class="w-3 h-3" />
      </button>
      <button type="button" class="text-xs font-medium text-text-muted dark:text-text-dark-muted hover:underline" @click="clearAll">
        Tout effacer
      </button>
    </div>
  </div>
</template>
