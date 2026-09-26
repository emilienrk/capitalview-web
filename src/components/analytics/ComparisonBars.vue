<script setup lang="ts">
/**
 * Two or three figures of the same kind, drawn on one shared axis.
 *
 * "Toi contre le hasard" read as four separate tiles made the reader do the
 * comparison; here the gap is the distance between two bars. The axis always
 * includes zero, and a zero line appears when the values straddle it.
 */
import { computed } from 'vue'
import { useReadingFormat } from '@/composables/useReadingFormat'
import type { ReadingFormat } from '@/types'

const props = defineProps<{
  items: { label: string; value: number | string | null; emphasis?: boolean }[]
  format: ReadingFormat
}>()

const { formatReading } = useReadingFormat()

const rows = computed(() => {
  const present = props.items
    .map((item) => ({ ...item, n: item.value === null ? NaN : Number(item.value) }))
    .filter((item) => Number.isFinite(item.n))
  if (!present.length) return { straddles: false, zero: 0, bars: [] }

  const low = Math.min(0, ...present.map((item) => item.n))
  const high = Math.max(0, ...present.map((item) => item.n))
  const span = high - low || 1
  return {
    straddles: low < 0 && high > 0,
    zero: (-low / span) * 100,
    bars: present.map((item) => ({
      ...item,
      left: ((Math.min(item.n, 0) - low) / span) * 100,
      width: (Math.abs(item.n) / span) * 100,
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
        {{ formatReading(bar.value, format) }}
      </span>
    </div>
  </div>
</template>
