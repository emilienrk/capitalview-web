<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
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

// The label's real width, so it can be kept inside the plot whatever its text.
const labelRef = ref<HTMLElement | null>(null)
const labelWidth = ref(0)
let labelObserver: ResizeObserver | null = null

watch(labelRef, (el) => {
  labelObserver?.disconnect()
  labelObserver = null
  if (!el) return
  labelWidth.value = el.offsetWidth
  labelObserver = new ResizeObserver(() => { labelWidth.value = el.offsetWidth })
  labelObserver.observe(el)
}, { flush: 'post' })

onBeforeUnmount(() => labelObserver?.disconnect())

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
    labelLeft: `${Math.max(m.plot.left, Math.min(m.plot.right - labelWidth.value, center - labelWidth.value / 2))}px`,
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
      ref="labelRef"
      class="absolute whitespace-nowrap rounded-secondary border border-surface-border dark:border-surface-dark-border bg-surface dark:bg-surface-dark px-2.5 py-1.5 text-center shadow-sm"
      :style="{ left: view.labelLeft, top: view.labelTop }"
    >
      <div :class="['text-xs font-semibold tabular-nums', view.up ? 'text-success' : 'text-danger']">
        {{ view.amount }}<template v-if="view.percent"> · {{ view.percent }}</template>
      </div>
      <div class="text-[10px] text-text-muted dark:text-text-dark-muted">{{ view.dates }}</div>
    </div>
  </div>
</template>
