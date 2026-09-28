<script setup lang="ts">
/**
 * What the net worth is made of, as one bar and its legend. The bar shows the
 * proportions at a glance; the legend carries the exact figures, so nothing is
 * only readable from a colour.
 */
import { computed } from 'vue'
import { useFormatters } from '@/composables/useFormatters'
import { usePrivacyMode } from '@/composables/usePrivacyMode'
import type { CompositionKey, CompositionSegment } from '@/utils/netWorth'

const props = withDefaults(
  defineProps<{
    segments: CompositionSegment[]
    /** Legend columns from the small breakpoint up; one column below it reads best on a phone. */
    columns?: 1 | 2
  }>(),
  { columns: 1 },
)

const { formatCurrency } = useFormatters()
const { maskValue } = usePrivacyMode()

// The history chart's own colours, so a pocket keeps its colour across the page.
const COLORS: Record<CompositionKey, string> = {
  bank: 'var(--cv-chart-bank)',
  stock: 'var(--cv-chart-stock)',
  crypto: 'var(--cv-chart-crypto)',
  placements: 'var(--cv-chart-placements)',
  brokerCash: 'var(--cv-chart-neutral)',
  assets: 'var(--cv-chart-assets)',
}

function share(value: number): string {
  return `${value.toLocaleString('fr-FR', { maximumFractionDigits: value < 10 ? 1 : 0 })} %`
}

const summary = computed(() => props.segments.map((s) => `${s.label} ${share(s.share)}`).join(', '))

/** A negative pocket has no length to draw: the bar splits what is held, the legend nets it off. */
const drawn = computed(() => {
  const positive = props.segments.filter((s) => s.value > 0)
  const sum = positive.reduce((total, s) => total + s.value, 0)
  return positive.map((s) => ({ ...s, width: sum > 0 ? (s.value / sum) * 100 : 0 }))
})
</script>

<template>
  <div v-if="segments.length">
    <div class="flex h-2 w-full gap-0.5 overflow-hidden rounded-full" role="img" :aria-label="`Répartition : ${summary}`">
      <span
        v-for="segment in drawn"
        :key="segment.key"
        class="h-full first:rounded-l-full last:rounded-r-full"
        :style="{ width: `${segment.width}%`, background: COLORS[segment.key] }"
      />
    </div>
    <dl
      class="mt-4 grid grid-cols-1 gap-x-8 gap-y-2"
      :class="columns === 2 ? 'sm:grid-cols-2' : ''"
    >
      <div v-for="segment in segments" :key="segment.key" class="flex items-baseline justify-between gap-3 text-sm">
        <dt class="flex min-w-0 items-center gap-2 text-text-muted dark:text-text-dark-muted">
          <span class="h-2 w-2 shrink-0 rounded-full" :style="{ background: COLORS[segment.key] }" />
          <span>{{ segment.label }}</span>
        </dt>
        <dd class="shrink-0 tabular-nums text-text-main dark:text-text-dark-main">
          {{ segment.value < 0 ? '−' : '' }}{{ maskValue(formatCurrency(Math.abs(segment.value))) }}
          <span class="ml-1 inline-block w-11 text-right text-xs text-text-muted dark:text-text-dark-muted">{{ segment.value < 0 ? '−' : '' }}{{ share(Math.abs(segment.share)) }}</span>
        </dd>
      </div>
    </dl>
  </div>
</template>
