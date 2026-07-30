<script setup lang="ts">
/**
 * One metric, one place where the reliability gate is honoured.
 *
 * Every block repeats the same rule — a withheld metric shows a dash and its
 * caveat, never a number — and repeating it by hand in each template is how one
 * block eventually forgets. There are no component tests in this repo, so the
 * rule lives in exactly one file on purpose.
 */
import { computed } from 'vue'
import { useFormatters } from '@/composables/useFormatters'
import { usePrivacyMode } from '@/composables/usePrivacyMode'
import ReliabilityBadge from '@/components/analytics/ReliabilityBadge.vue'
import type { MetricOut } from '@/types'

type Kind = 'pct' | 'eur' | 'bps' | 'days' | 'months' | 'count' | 'ratio'

const props = withDefaults(
  defineProps<{
    label: string
    metric: MetricOut
    kind?: Kind
    signed?: boolean
    /** Inverts the colour: for a cost, a positive number is bad news. */
    invert?: boolean
  }>(),
  { kind: 'ratio', signed: false, invert: false },
)

const { formatCurrency, formatPercent, profitLossClass } = useFormatters()
const { maskValue } = usePrivacyMode()

const hasValue = computed(() => props.metric.value !== null && props.metric.value !== undefined)

const display = computed(() => {
  if (!hasValue.value) return '—'
  const n = Number(props.metric.value)
  switch (props.kind) {
    case 'pct':
      return formatPercent(n * 100)
    case 'eur':
      return maskValue(formatCurrency(n))
    case 'bps':
      return `${n > 0 ? '+' : ''}${Math.round(n)} bps`
    case 'days':
      return `${Math.round(n)} j`
    case 'months':
      return `${Math.round(n)} mois`
    case 'count':
      return n.toFixed(1)
    default:
      return n.toFixed(2)
  }
})

const toneClass = computed(() => {
  if (!props.signed || !hasValue.value) return 'text-text-main dark:text-text-dark-main'
  const n = Number(props.metric.value)
  return profitLossClass(props.invert ? -n : n)
})
</script>

<template>
  <div>
    <p
      class="mb-1 text-[11px] font-medium uppercase tracking-wider text-text-muted dark:text-text-dark-muted"
    >
      {{ label }}
    </p>
    <p :class="['mb-2 text-2xl font-bold tabular-nums', toneClass]">{{ display }}</p>
    <ReliabilityBadge :reliability="metric.reliability" :caveat="metric.caveat" />
  </div>
</template>
