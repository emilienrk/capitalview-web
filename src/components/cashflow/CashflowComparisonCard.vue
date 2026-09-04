<script setup lang="ts">
/**
 * Each declared flow against what actually moved for it.
 *
 * Nothing is linked behind the user's back. The app groups real movements by
 * label and proposes the ones that could be a declaration's counterpart; the
 * link only becomes durable once the user picks one, because amount and spacing
 * cannot tell two 9,99 € subscriptions apart and only they know which is which.
 */
import { computed, onMounted, ref } from 'vue'
import { RefreshCw } from 'lucide-vue-next'

import { useCashflowStore } from '@/stores/cashflow'
import { useFormatters } from '@/composables/useFormatters'
import { usePrivacyMode } from '@/composables/usePrivacyMode'
import {
  BaseBadge, BaseButton, BaseCard, BaseEmptyState, BaseSelect, BaseSkeleton,
} from '@/components'
import type { BadgeVariant } from '@/components/base/BaseBadge.vue'
import type { CashflowComparison, ComparisonStatus } from '@/types'

const cashflow = useCashflowStore()
const { formatCurrency, formatDate } = useFormatters()
const { maskValue } = usePrivacyMode()

const saving = ref<string | null>(null)

const STATUS_LABELS: Record<ComparisonStatus, string> = {
  unmatched: 'À rapprocher',
  missing: 'Plus rien ne bouge',
  duplicated: 'Passé deux fois',
  drifted: 'Montant qui dérive',
  on_track: 'Conforme',
}

const STATUS_VARIANTS: Record<ComparisonStatus, BadgeVariant> = {
  unmatched: 'secondary',
  missing: 'warning',
  duplicated: 'danger',
  drifted: 'warning',
  on_track: 'success',
}

// Worth acting on first: a flow that stopped or doubled costs real money, a
// conforming one asks for nothing.
const ORDER: ComparisonStatus[] = ['duplicated', 'drifted', 'missing', 'unmatched', 'on_track']

const rows = computed(() =>
  [...cashflow.comparison].sort(
    (a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status),
  ),
)

const needsAttention = computed(
  () => rows.value.filter((row) => row.status !== 'on_track').length,
)

function amount(row: CashflowComparison, value: number | null): string {
  return value === null ? '—' : maskValue(formatCurrency(value, row.currency))
}

function gap(row: CashflowComparison): string | null {
  if (row.observed_amount === null) return null
  const delta = row.observed_amount - row.declared_amount
  if (delta === 0) return null
  const sign = delta > 0 ? '+' : ''
  return `${sign}${maskValue(formatCurrency(delta, row.currency))}`
}

async function confirmMatch(row: CashflowComparison, pattern: string): Promise<void> {
  saving.value = row.cashflow_id
  await cashflow.updateMatch(row.cashflow_id, pattern || null)
  saving.value = null
}

onMounted(() => void cashflow.fetchComparison())
</script>

<template>
  <BaseCard class="mb-6">
    <template #header>
      <div class="flex items-start sm:items-center justify-between gap-3">
        <div>
          <h3 class="text-lg font-semibold text-text-main dark:text-text-dark-main">
            Prévu contre réel
          </h3>
          <p class="text-sm text-text-muted dark:text-text-dark-muted mt-0.5">
            Ce que vos comptes disent de chacun des flux déclarés ci-dessous
          </p>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <BaseBadge v-if="needsAttention > 0" variant="warning">
            {{ needsAttention }} à regarder
          </BaseBadge>
          <BaseButton icon size="sm" variant="outline" @click="cashflow.fetchComparison()">
            <RefreshCw class="w-4 h-4" />
          </BaseButton>
        </div>
      </div>
    </template>

    <div v-if="cashflow.comparisonLoading && !rows.length" class="space-y-2">
      <BaseSkeleton v-for="n in 3" :key="n" variant="rect" width="100%" height="3.5rem" />
    </div>

    <BaseEmptyState
      v-else-if="!rows.length"
      title="Rien à rapprocher"
      description="Déclarez un flux et synchronisez une banque pour comparer le prévu au réel."
    />

    <div v-else class="space-y-3">
      <div
        v-for="row in rows"
        :key="row.cashflow_id"
        class="rounded-card border border-surface-border dark:border-surface-dark-border p-3"
      >
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="min-w-0">
            <p class="font-medium text-text-main dark:text-text-dark-main truncate">{{ row.name }}</p>
            <p class="text-sm text-text-muted dark:text-text-dark-muted">
              Déclaré {{ amount(row, row.declared_amount) }}
              <template v-if="row.observed_amount !== null">
                · observé {{ amount(row, row.observed_amount) }}
                <span v-if="gap(row)" :class="row.status === 'on_track' ? '' : 'font-medium'">
                  ({{ gap(row) }})
                </span>
              </template>
            </p>
          </div>
          <BaseBadge :variant="STATUS_VARIANTS[row.status]">{{ STATUS_LABELS[row.status] }}</BaseBadge>
        </div>

        <!-- The app proposes, the user confirms — and can take it back. -->
        <div v-if="row.status === 'unmatched'" class="mt-2">
          <BaseSelect
            v-if="row.candidates.length"
            :model-value="''"
            :disabled="saving === row.cashflow_id"
            :options="[
              { label: 'Choisir le libellé correspondant…', value: '' },
              ...row.candidates.map((c) => ({
                label: `${c.pattern} — ${maskValue(formatCurrency(c.observed_amount, row.currency))}, ${c.occurrences} fois`,
                value: c.pattern,
              })),
            ]"
            @update:model-value="(value) => value && confirmMatch(row, String(value))"
          />
          <p v-else class="text-sm text-text-muted dark:text-text-dark-muted">
            Aucun mouvement récurrent ne ressemble à ce flux pour l'instant.
          </p>
        </div>

        <div v-else-if="row.match_pattern" class="mt-2 flex flex-wrap items-center gap-2">
          <span class="text-sm text-text-muted dark:text-text-dark-muted">
            Rapproché de <span class="font-mono">{{ row.match_pattern }}</span>
            <template v-if="row.last_seen"> · vu le {{ formatDate(row.last_seen) }}</template>
          </span>
          <BaseButton
            size="sm"
            variant="outline"
            :disabled="saving === row.cashflow_id"
            @click="confirmMatch(row, '')"
          >
            Délier
          </BaseButton>
        </div>

        <p v-if="row.recent.length" class="mt-2 text-xs text-text-muted dark:text-text-dark-muted">
          Derniers passages :
          <span v-for="(occurrence, index) in row.recent" :key="occurrence.day">
            <template v-if="index > 0"> · </template>
            {{ formatDate(occurrence.day) }} {{ maskValue(formatCurrency(occurrence.amount, row.currency)) }}
          </span>
        </p>
      </div>
    </div>
  </BaseCard>
</template>
