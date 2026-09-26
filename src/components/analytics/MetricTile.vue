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
import ReadingScale from '@/components/analytics/ReadingScale.vue'
import { useReadingFormat } from '@/composables/useReadingFormat'
import type { MetricOut, ReadingOut, Tone } from '@/types'

type Kind = 'pct' | 'eur' | 'bps' | 'days' | 'months' | 'points' | 'count' | 'ratio' | 'times'

const props = withDefaults(
  defineProps<{
    label: string
    metric: MetricOut
    kind?: Kind
    signed?: boolean
    /** Inverts the colour: for a cost, a positive number is bad news. */
    invert?: boolean
    /** The block's headline: coloured by its band, with the scale drawn under it. */
    reading?: ReadingOut | null
  }>(),
  { kind: 'ratio', signed: false, invert: false, reading: null },
)

const { formatCurrency, formatPercent, profitLossClass } = useFormatters()
const { maskValue } = usePrivacyMode()
const { formatReading } = useReadingFormat()

const hasValue = computed(() => props.metric.value !== null && props.metric.value !== undefined)

const display = computed(() => {
  if (!hasValue.value) return '—'
  const n = Number(props.metric.value)
  switch (props.kind) {
    case 'pct': {
      const formatted = formatPercent(n * 100)
      // formatPercent always signs; a share or a rate is not a variation.
      return props.signed ? formatted : formatted.replace(/^\+/, '')
    }
    case 'eur':
      return maskValue(formatCurrency(n))
    case 'bps': {
      const formatted = formatReading(n, 'bps')
      return props.signed && n > 0 ? `+${formatted}` : formatted
    }
    case 'times':
      return formatReading(n, 'times')
    case 'days':
      return `${Math.round(n)} j`
    case 'months':
      return `${Math.round(n)} mois`
    case 'points':
      return `${n.toFixed(1)} pts`
    case 'count':
      return n.toFixed(1)
    default:
      return n.toFixed(2)
  }
})

const readingTone: Record<Tone, string> = {
  good: 'text-success',
  watch: 'text-warning',
  bad: 'text-danger',
}

const toneClass = computed(() => {
  if (props.reading?.tone && hasValue.value) return readingTone[props.reading.tone]
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
    <!-- The marker sits against the figure it qualifies, not under it: a solid
         metric renders nothing at all, so the tile keeps its height either way. -->
    <p :class="['flex items-center gap-1.5 text-2xl font-bold tabular-nums', toneClass]">
      {{ display }}
      <ReliabilityBadge :reliability="metric.reliability" :caveat="metric.caveat" />
    </p>
    <ReadingScale v-if="reading && hasValue" :reading="reading" />
  </div>
</template>
