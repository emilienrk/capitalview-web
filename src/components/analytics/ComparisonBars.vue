<script setup lang="ts">
/**
 * Two or three figures of the same kind, drawn on one shared axis.
 *
 * "Toi contre le hasard" read as four separate tiles made the reader do the
 * comparison; here the gap is the distance between two bars. The axis always
 * includes zero, and a zero line appears when the values straddle it.
 */
import { computed } from 'vue'
import { useFormatters } from '@/composables/useFormatters'
import { useReadingFormat } from '@/composables/useReadingFormat'
import type { ReadingFormat } from '@/types'

const props = defineProps<{
  items: { label: string; value: number | string | null; emphasis?: boolean }[]
  format: ReadingFormat
}>()

const { formatReading } = useReadingFormat()
// Two decimals for bare ratios: two variation coefficients of 0,96 and 1,04
// would both print 1,0 and look identical.
const { formatNumber } = useFormatters()

const rows = computed(() => {
  const present = props.items
    .map((item) => ({ ...item, n: item.value === null ? NaN : Number(item.value) }))
    .filter((item) => Number.isFinite(item.n))
  if (!present.length) return { straddles: false, zero: 0, bars: [] }

  // All at or below zero (a drawdown): drawn as magnitudes from the left, so a
  // longer bar still reads as "further", instead of bars hanging off the right edge.
  const allNegative = present.every((item) => item.n <= 0)
  const values = present.map((item) => (allNegative ? -item.n : item.n))
  const low = Math.min(0, ...values)
  const high = Math.max(0, ...values)
  const span = high - low || 1
  return {
    straddles: low < 0 && high > 0,
    zero: (-low / span) * 100,
    bars: present.map((item, index) => ({
      ...item,
      left: ((Math.min(values[index]!, 0) - low) / span) * 100,
      width: (Math.abs(values[index]!) / span) * 100,
    })),
  }
})
</script>

<template>
  <div v-if="rows.bars.length" class="space-y-1.5">
    <div
      v-for="bar in rows.bars"
      :key="bar.label"
      class="grid grid-cols-[7rem_1fr_4.5rem] items-center gap-2 text-xs"
    >
      <span
        :class="[
          'truncate',
          bar.emphasis
            ? 'font-medium text-text-main dark:text-text-dark-main'
            : 'text-text-muted dark:text-text-dark-muted',
        ]"
      >
        {{ bar.label }}
      </span>
      <div class="relative h-2 rounded-full bg-background-subtle dark:bg-background-dark-subtle">
        <span
          :class="[
            'absolute inset-y-0 rounded-full',
            bar.emphasis ? 'bg-primary' : 'bg-secondary/40',
          ]"
          :style="{ left: `${bar.left}%`, width: `${Math.max(bar.width, 1)}%` }"
        />
        <span
          v-if="rows.straddles"
          class="absolute -inset-y-0.5 w-px bg-text-muted dark:bg-text-dark-muted"
          :style="{ left: `${rows.zero}%` }"
        />
      </div>
      <span
        :class="[
          'text-right tabular-nums',
          bar.emphasis
            ? 'font-semibold text-text-main dark:text-text-dark-main'
            : 'text-text-muted dark:text-text-dark-muted',
        ]"
      >
        {{ format === 'decimal' ? formatNumber(bar.n, 2) : formatReading(bar.value, format) }}
      </span>
    </div>
  </div>
</template>
