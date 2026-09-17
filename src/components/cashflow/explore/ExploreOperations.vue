<script setup lang="ts">
/** The operations of the selection, newest or largest first, fifty at a time. */
import { computed, ref, watch } from 'vue'
import { ArrowLeftRight, Download, HelpCircle, Link2 } from 'lucide-vue-next'

import { BaseBadge, BaseButton, BaseCard, BaseSegmentedControl } from '@/components'
import { useFormatters } from '@/composables/useFormatters'
import { usePrivacyMode } from '@/composables/usePrivacyMode'
import { CASHFLOW_TYPE_LABELS, CASHFLOW_TYPE_TONES, OPERATION_TYPE_LABELS } from '@/utils/cashflowTypes'
import type { LedgerEntry } from '@/utils/ledger'

const props = defineProps<{ entries: LedgerEntry[] }>()

const emit = defineEmits<{
  retype: [entry: LedgerEntry]
  export: []
  'copy-link': []
}>()

const { formatCurrency } = useFormatters()
const { maskValue } = usePrivacyMode()

const PAGE = 50
const limit = ref(PAGE)
const sort = ref<'date' | 'amount'>('date')
const sortOptions = [
  { label: 'Plus récentes', value: 'date' },
  { label: 'Plus gros montants', value: 'amount' },
]

watch(() => props.entries, () => { limit.value = PAGE })

const sorted = computed(() =>
  sort.value === 'amount' ? [...props.entries].sort((a, b) => b.amount - a.amount) : props.entries,
)
const shown = computed(() => sorted.value.slice(0, limit.value))

function day(entry: LedgerEntry): string {
  if (!entry.day) return 'Sans date'
  const [year, month, date] = entry.day.split('-').map(Number)
  return new Date(year!, month! - 1, date!).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** A settled pair counts by its pair, undone in Opérations: no type to pick here. */
function typable(entry: LedgerEntry): boolean {
  return entry.transferStatus === null || entry.transferStatus === 'suggested'
}

function amountClass(entry: LedgerEntry): string {
  if (!entry.counted || entry.cashflowType === 'NEUTRAL') return 'text-text-muted dark:text-text-dark-muted'
  return entry.isCredit ? 'text-success' : 'text-text-main dark:text-text-dark-main'
}
</script>

<template>
  <BaseCard :padding="false" class="overflow-hidden">
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h3 class="text-base font-semibold text-text-main dark:text-text-dark-main">
          Opérations <span class="font-normal text-text-muted dark:text-text-dark-muted">({{ entries.length.toLocaleString('fr-FR') }})</span>
        </h3>
        <div class="flex flex-wrap items-center gap-2">
          <BaseSegmentedControl v-model="sort" :options="sortOptions" size="sm" />
          <BaseButton size="sm" variant="ghost" :disabled="!entries.length" @click="emit('export')">
            <Download class="w-4 h-4 mr-1" /> CSV
          </BaseButton>
          <BaseButton size="sm" variant="ghost" @click="emit('copy-link')">
            <Link2 class="w-4 h-4 mr-1" /> Lien
          </BaseButton>
        </div>
      </div>
    </template>

    <ul v-if="shown.length" class="divide-y divide-surface-border dark:divide-surface-dark-border">
      <li v-for="entry in shown" :key="entry.id" :class="['flex items-center gap-3 px-4 sm:px-6 py-3', entry.isPending ? 'opacity-70' : '']">
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium text-text-main dark:text-text-dark-main" :title="entry.label">
            {{ entry.group.name || entry.label || 'Opération sans libellé' }}
          </p>
          <div class="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-text-muted dark:text-text-dark-muted">
            <span>{{ day(entry) }}</span>
            <span aria-hidden="true">·</span>
            <span>{{ entry.account.name }}</span>
            <span v-if="entry.operationType !== 'UNKNOWN'">{{ OPERATION_TYPE_LABELS[entry.operationType] }}</span>
            <button
              v-if="typable(entry)"
              type="button"
              :class="['px-2 py-0.5 rounded-full font-medium transition-opacity hover:opacity-80', CASHFLOW_TYPE_TONES[entry.cashflowType]]"
              :title="entry.typeSource === 'default' ? 'Type détecté : le changer' : 'Type choisi : le changer'"
              @click="emit('retype', entry)"
            >
              {{ CASHFLOW_TYPE_LABELS[entry.cashflowType] }}
            </button>
            <BaseBadge v-else variant="info">
              <ArrowLeftRight class="inline w-3 h-3 mr-1 -mt-px" />{{ CASHFLOW_TYPE_LABELS[entry.cashflowType] }}
            </BaseBadge>
            <BaseBadge v-if="entry.isPending" variant="warning">En attente</BaseBadge>
            <router-link v-if="entry.open" :to="{ name: 'bank-review' }" class="inline-flex items-center gap-1 font-medium text-warning hover:underline">
              <HelpCircle class="w-3 h-3" /> à confirmer
            </router-link>
          </div>
          <p v-if="entry.group.name && entry.label !== entry.group.name" class="mt-0.5 truncate text-xs text-text-muted/80 dark:text-text-dark-muted/80" :title="entry.label">
            {{ entry.label }}
          </p>
        </div>
        <p :class="['shrink-0 text-sm font-semibold tabular-nums', amountClass(entry)]">
          {{ maskValue(formatCurrency(entry.bankSigned, entry.currency)) }}
        </p>
      </li>
    </ul>
    <p v-else class="px-4 sm:px-6 py-6 text-sm text-text-muted dark:text-text-dark-muted">Aucune opération dans cette sélection.</p>
    <button
      v-if="sorted.length > limit"
      type="button"
      class="w-full px-4 py-2.5 text-sm font-medium text-primary hover:bg-surface-hover dark:hover:bg-surface-dark-hover border-t border-surface-border dark:border-surface-dark-border"
      @click="limit += PAGE"
    >
      Afficher plus ({{ (sorted.length - limit).toLocaleString('fr-FR') }} restantes)
    </button>
  </BaseCard>
</template>
