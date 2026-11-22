<script setup lang="ts">
import { computed } from 'vue'
import type { ChartMeasure } from '@/composables/useChartMeasure'
import { useFormatters } from '@/composables/useFormatters'
import { usePrivacyMode } from '@/composables/usePrivacyMode'

const props = defineProps<{
  measure: ChartMeasure | null
  /** Defaults to two-decimal euros; a price chart passes its own for sub-euro quotes. */
  formatValue?: (value: number) => string
  formatDate?: (date: string) => string
}>()

const { formatCurrency, formatPercent } = useFormatters()
const { maskValue } = usePrivacyMode()

// Half the label's usual width, so it never hangs off either side of the plot.
const LABEL_HALF_WIDTH = 84

const view = computed(() => {
  const m = props.measure
  if (!m) return null
  const up = m.diff >= 0
  const amount = (props.formatValue ?? formatCurrency)(Math.abs(m.diff))
  const date = props.formatDate ?? ((d: string) =>
    new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }))
  const center = (m.fromX + m.toX) / 2
  return {
    up,
    amount: `${up ? '+' : '−'}${maskValue(amount)}`,
    percent: m.percent == null ? null : formatPercent(m.percent).replace('-', '−'),
    dates: `${date(m.fromDate)} → ${date(m.toDate)}`,
    band: {
      left: `${m.fromX}px`,
      width: `${Math.max(1, m.toX - m.fromX)}px`,
      top: `${m.plot.top}px`,
      height: `${m.plot.bottom - m.plot.top}px`,
    },
    labelLeft: `${Math.min(m.plot.right - LABEL_HALF_WIDTH, Math.max(m.plot.left + LABEL_HALF_WIDTH, center))}px`,
    labelTop: `${m.plot.top + 4}px`,
    from: { left: `${m.fromX}px`, top: `${m.fromY}px` },
    to: { left: `${m.toX}px`, top: `${m.toY}px` },
  }
})
</script>

<template>
  <div v-if="view" class="pointer-events-none absolute inset-0 z-10" aria-live="polite">
    <div
      :class="['absolute border-x', view.up ? 'bg-success/10 border-success/50' : 'bg-danger/10 border-danger/50']"
      :style="view.band"
    />
    <span
      v-for="(point, key) in { from: view.from, to: view.to }"
      :key="key"
      :class="['absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface dark:ring-surface-dark', view.up ? 'bg-success' : 'bg-danger']"
      :style="point"
    />
    <div
      class="absolute -translate-x-1/2 whitespace-nowrap rounded-secondary border border-surface-border dark:border-surface-dark-border bg-surface dark:bg-surface-dark px-2.5 py-1.5 text-center shadow-sm"
      :style="{ left: view.labelLeft, top: view.labelTop }"
    >
      <div :class="['text-xs font-semibold tabular-nums', view.up ? 'text-success' : 'text-danger']">
        {{ view.amount }}<template v-if="view.percent"> · {{ view.percent }}</template>
      </div>
      <div class="text-[10px] text-text-muted dark:text-text-dark-muted">{{ view.dates }}</div>
    </div>
  </div>
</template>
