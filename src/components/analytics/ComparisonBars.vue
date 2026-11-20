<script setup lang="ts">
/**
 * Two or three figures of the same kind, drawn on one shared axis.
 *
 * "Toi contre le hasard" read as four separate tiles made the reader do the
 * comparison; here the gap is the distance between two bars. The axis always
 * includes zero, and a zero line appears when the values straddle it.
 *
 * With `columns`, each row also carries a reference — a sector against the
 * benchmark's share of it — drawn as a thinner bar under the first, on the same
 * axis. A missing figure on either side prints a dash and draws nothing: the
 * row stays, since one side holding what the other lacks is the point.
 */
import { computed } from 'vue'
import { useFormatters } from '@/composables/useFormatters'
import { useReadingFormat } from '@/composables/useReadingFormat'
import type { ReadingFormat } from '@/types'

type Figure = number | string | null | undefined

const props = defineProps<{
  items: { label: string; value: Figure; reference?: Figure; emphasis?: boolean }[]
  format: ReadingFormat
  /** Room for a sector or a country name rather than "Vous" against "Indice". */
  wideLabels?: boolean
  /** Titles of the value and the reference columns; without them there is no reference. */
  columns?: [string, string]
}>()

const { formatReading } = useReadingFormat()
// Two decimals for bare ratios: two variation coefficients of 0,96 and 1,04
// would both print 1,0 and look identical.
const { formatNumber } = useFormatters()

function toNumber(value: Figure): number {
  return value === null || value === undefined ? NaN : Number(value)
}

const grid = computed(() => {
  // On a phone the bars drop under the label: four columns side by side
  // would leave them a few pixels.
  if (props.columns) return 'grid-cols-[1fr_3.5rem_3.5rem] @md:grid-cols-[10rem_1fr_3.5rem_3.5rem]'
  return props.wideLabels ? 'grid-cols-[10rem_1fr_3.5rem]' : 'grid-cols-[7rem_1fr_4.5rem]'
})

const rows = computed(() => {
  const present = props.items
    .map((item) => ({
      ...item,
      n: toNumber(item.value),
      r: props.columns ? toNumber(item.reference) : NaN,
    }))
    .filter((item) => Number.isFinite(item.n) || Number.isFinite(item.r))
  if (!present.length) return { straddles: false, zero: 0, bars: [] }

  const figures = present.flatMap((item) => [item.n, item.r]).filter(Number.isFinite)
  // All at or below zero (a drawdown): drawn as magnitudes from the left, so a
  // longer bar still reads as "further", instead of bars hanging off the right edge.
  const sign = figures.every((n) => n <= 0) ? -1 : 1
  const low = Math.min(0, ...figures.map((n) => sign * n))
  const high = Math.max(0, ...figures.map((n) => sign * n))
  const span = high - low || 1
  const place = (n: number) =>
    Number.isFinite(n)
      ? {
          left: ((Math.min(sign * n, 0) - low) / span) * 100,
          width: (Math.abs(sign * n) / span) * 100,
        }
      : null
  return {
    straddles: low < 0 && high > 0,
    zero: (-low / span) * 100,
    bars: present.map((item) => ({ ...item, main: place(item.n), second: place(item.r) })),
  }
})

/** A sliver for a tiny share, so it does not vanish; nothing for an exact zero. */
function visible(width: number): number {
  return width > 0 ? Math.max(width, 1) : 0
}

function shown(n: number, raw: Figure): string {
  return props.format === 'decimal' ? formatNumber(n, 2) : formatReading(raw, props.format)
}
</script>

<template>
  <div v-if="rows.bars.length" class="@container space-y-1.5">
    <div
      v-if="columns"
      :class="[
        'grid items-center gap-x-2 text-[11px] text-text-muted dark:text-text-dark-muted',
        grid,
      ]"
    >
      <span class="@md:col-span-2" />
      <span class="flex items-center justify-end gap-1">
        <span class="h-2 w-2.5 rounded-full bg-primary" />
        {{ columns[0] }}
      </span>
      <span class="flex items-center justify-end gap-1">
        <span class="h-1 w-2.5 rounded-full bg-text-muted/60 dark:bg-text-dark-muted/60" />
        {{ columns[1] }}
      </span>
    </div>
    <div
      v-for="bar in rows.bars"
      :key="bar.label"
      :class="['grid items-center gap-x-2 gap-y-1 text-xs', grid]"
    >
      <span
        :title="bar.label"
        :class="[
          'truncate',
          bar.emphasis
            ? 'font-medium text-text-main dark:text-text-dark-main'
            : 'text-text-muted dark:text-text-dark-muted',
        ]"
      >
        {{ bar.label }}
      </span>
      <div :class="columns ? 'order-last col-span-3 @md:order-none @md:col-span-1' : ''">
        <div class="relative h-2 rounded-full bg-background-subtle dark:bg-background-dark-subtle">
          <span
            v-if="bar.main"
            :class="[
              'absolute inset-y-0 rounded-full',
              bar.emphasis ? 'bg-primary' : 'bg-secondary/40',
            ]"
            :style="{ left: `${bar.main.left}%`, width: `${visible(bar.main.width)}%` }"
          />
          <span
            v-if="rows.straddles"
            class="absolute -inset-y-0.5 w-px bg-text-muted dark:bg-text-dark-muted"
            :style="{ left: `${rows.zero}%` }"
          />
        </div>
        <div
          v-if="columns"
          class="relative mt-0.5 h-1 rounded-full bg-background-subtle dark:bg-background-dark-subtle"
        >
          <span
            v-if="bar.second"
            class="absolute inset-y-0 rounded-full bg-text-muted/60 dark:bg-text-dark-muted/60"
            :style="{ left: `${bar.second.left}%`, width: `${visible(bar.second.width)}%` }"
          />
        </div>
      </div>
      <span
        :class="[
          'text-right tabular-nums',
          bar.emphasis
            ? 'font-semibold text-text-main dark:text-text-dark-main'
            : 'text-text-muted dark:text-text-dark-muted',
        ]"
      >
        {{ shown(bar.n, bar.value) }}
      </span>
      <span v-if="columns" class="text-right tabular-nums text-text-muted dark:text-text-dark-muted">
        {{ shown(bar.r, bar.reference) }}
      </span>
    </div>
  </div>
</template>
