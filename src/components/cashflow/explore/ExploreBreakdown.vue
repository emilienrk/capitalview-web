<script setup lang="ts">
/**
 * The selection split along one dimension: each line its total, its share,
 * its average ticket, its last twelve months and its change against the
 * period before. A line opens as a filter, so the split can be dug into.
 */
import { computed, ref } from 'vue'

import { BaseCard, BaseSelect } from '@/components'
import { useFormatters } from '@/composables/useFormatters'
import { usePrivacyMode } from '@/composables/usePrivacyMode'
import { DIMENSION_LABELS, type Bucket, type Dimension } from '@/utils/ledger'

const props = defineProps<{
  buckets: Bucket[]
  /** Last period's totals by bucket key, for the change column. */
  previous: Map<string, number> | null
  by: Dimension
  currency: string
}>()

const emit = defineEmits<{
  'update:by': [value: Dimension]
  select: [bucket: Bucket]
}>()

const { formatCurrency, formatDate } = useFormatters()
const { maskValue, privacyMode } = usePrivacyMode()

const SHOWN = 15
const expanded = ref(false)
const shown = computed(() => (expanded.value ? props.buckets : props.buckets.slice(0, SHOWN)))

const options = (Object.keys(DIMENSION_LABELS) as Dimension[]).map((value) => ({ label: DIMENSION_LABELS[value], value }))
/** Only these narrow the selection when clicked; the others would need a filter the page does not have. */
const selectable = computed(() => ['group', 'month', 'account', 'means', 'type', 'amount-band'].includes(props.by))

function amount(value: number): string {
  return maskValue(formatCurrency(value, props.currency))
}

/**
 * How much the line weighs against the period before, in size: a sign would
 * read "less" for more spending, totals of spending being negative.
 */
function change(bucket: Bucket): { text: string; tone: string } | null {
  const before = props.previous?.get(bucket.key)
  if (before === undefined || before === 0) return props.previous ? { text: 'nouveau', tone: 'text-info' } : null
  const ratio = Math.abs(bucket.total) / Math.abs(before)
  const pct = (ratio - 1) * 100
  if (Math.abs(pct) < 1) return { text: '=', tone: 'text-text-muted dark:text-text-dark-muted' }
  return {
    text: ratio >= 10
      ? `×${ratio.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}`
      : `${pct > 0 ? '+' : '−'}${Math.abs(pct).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} %`,
    tone: pct > 0 ? 'text-text-main dark:text-text-dark-main' : 'text-text-muted dark:text-text-dark-muted',
  }
}

/** A twelve-point line, drawn once per row without a chart instance. */
function sparkPath(values: number[]): string {
  if (!values.length) return ''
  const magnitudes = values.map((value) => Math.abs(value))
  const peak = Math.max(...magnitudes) || 1
  const step = values.length > 1 ? 60 / (values.length - 1) : 0
  return magnitudes.map((value, i) => `${i ? 'L' : 'M'}${(i * step).toFixed(1)},${(18 - (value / peak) * 16).toFixed(1)}`).join(' ')
}
</script>

<template>
  <BaseCard :padding="false">
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h3 class="text-base font-semibold text-text-main dark:text-text-dark-main">Répartition</h3>
        <div class="w-56">
          <BaseSelect
            :model-value="by"
            :options="options"
            aria-label="Regrouper par"
            @update:model-value="(value) => value && emit('update:by', value as Dimension)"
          />
        </div>
      </div>
    </template>

    <div v-if="buckets.length" class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="text-xs text-text-muted dark:text-text-dark-muted border-b border-surface-border dark:border-surface-dark-border">
            <th class="px-4 sm:px-6 py-2 text-left font-medium">{{ DIMENSION_LABELS[by] }}</th>
            <th class="px-3 py-2 text-right font-medium">Total</th>
            <th class="hidden md:table-cell px-3 py-2 text-right font-medium">Opérations</th>
            <th class="hidden md:table-cell px-3 py-2 text-right font-medium">Panier moyen</th>
            <th class="hidden lg:table-cell px-3 py-2 text-left font-medium">12 derniers mois</th>
            <th class="hidden sm:table-cell px-4 sm:px-6 py-2 text-right font-medium" title="Poids de la ligne contre la période précédente">vs avant</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-surface-border dark:divide-surface-dark-border">
          <tr
            v-for="bucket in shown"
            :key="bucket.key"
            :class="selectable ? 'cursor-pointer hover:bg-surface-hover dark:hover:bg-surface-dark-hover' : ''"
            :tabindex="selectable ? 0 : undefined"
            @click="selectable && emit('select', bucket)"
            @keydown.enter="selectable && emit('select', bucket)"
          >
            <td class="px-4 sm:px-6 py-2.5 max-w-[16rem]">
              <p class="truncate font-medium text-text-main dark:text-text-dark-main" :title="bucket.label">{{ bucket.label }}</p>
              <div class="mt-1 flex items-center gap-2">
                <div class="h-1.5 w-24 sm:w-32 rounded-full bg-background-subtle dark:bg-background-dark-subtle overflow-hidden">
                  <div :class="['h-full rounded-full', bucket.total < 0 ? 'bg-success/70' : 'bg-primary/70']" :style="{ width: `${Math.max(2, bucket.share)}%` }" />
                </div>
                <span class="text-xs tabular-nums text-text-muted dark:text-text-dark-muted">{{ bucket.share.toLocaleString('fr-FR', { maximumFractionDigits: 1 }) }} %</span>
              </div>
              <p class="md:hidden mt-0.5 text-xs text-text-muted dark:text-text-dark-muted">
                {{ bucket.count }} op. · {{ amount(bucket.averageTicket) }} en moyenne
              </p>
            </td>
            <td class="px-3 py-2.5 text-right font-semibold tabular-nums text-text-main dark:text-text-dark-main whitespace-nowrap">{{ amount(bucket.total) }}</td>
            <td class="hidden md:table-cell px-3 py-2.5 text-right tabular-nums text-text-muted dark:text-text-dark-muted">
              {{ bucket.count }}
              <span v-if="bucket.lastDay" class="block text-xs">dernière {{ formatDate(bucket.lastDay) }}</span>
            </td>
            <td class="hidden md:table-cell px-3 py-2.5 text-right tabular-nums text-text-muted dark:text-text-dark-muted whitespace-nowrap">{{ amount(bucket.averageTicket) }}</td>
            <td class="hidden lg:table-cell px-3 py-2.5">
              <svg v-if="!privacyMode" width="60" height="20" viewBox="0 0 60 20" aria-hidden="true" class="text-primary">
                <path :d="sparkPath(bucket.spark)" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
              </svg>
            </td>
            <td class="hidden sm:table-cell px-4 sm:px-6 py-2.5 text-right text-xs font-medium tabular-nums whitespace-nowrap">
              <span v-if="change(bucket)" :class="change(bucket)!.tone">{{ change(bucket)!.text }}</span>
            </td>
          </tr>
        </tbody>
      </table>
      <button
        v-if="buckets.length > SHOWN"
        type="button"
        class="w-full px-4 py-2.5 text-sm font-medium text-primary hover:bg-surface-hover dark:hover:bg-surface-dark-hover border-t border-surface-border dark:border-surface-dark-border"
        @click="expanded = !expanded"
      >
        {{ expanded ? 'Afficher moins' : `Afficher les ${buckets.length} lignes` }}
      </button>
    </div>
    <p v-else class="px-4 sm:px-6 py-6 text-sm text-text-muted dark:text-text-dark-muted">Aucune opération dans cette sélection.</p>
  </BaseCard>
</template>
