<script setup lang="ts">
/**
 * Where a figure sits on the scale the page itself judges it by.
 *
 * "0,20 %" means nothing without knowing that the line is drawn at 0,25. The
 * bands and the active one come from the API, which uses the very same
 * thresholds for its signals — a scale that disagreed with the board at the top
 * of the page would be worse than no scale.
 *
 * The last band has no ceiling: it runs to infinity.
 */
import { useReadingFormat } from '@/composables/useReadingFormat'
import type { ReadingOut, Tone } from '@/types'

defineProps<{ reading: ReadingOut }>()

const { formatReading } = useReadingFormat()

const fill: Record<Tone, string> = {
  good: 'bg-success',
  watch: 'bg-warning',
  bad: 'bg-danger',
}

const text: Record<Tone, string> = {
  good: 'text-success',
  watch: 'text-warning',
  bad: 'text-danger',
}
</script>

<template>
  <div class="mt-2">
    <div class="flex gap-0.5">
      <span
        v-for="(band, index) in reading.bands"
        :key="band.label"
        :class="[
          'h-1.5 flex-1 rounded-full',
          fill[band.tone],
          index === reading.active ? 'opacity-100' : 'opacity-20',
        ]"
      />
    </div>
    <div class="mt-1 flex gap-0.5 text-[11px] leading-tight">
      <span
        v-for="(band, index) in reading.bands"
        :key="band.label"
        :class="[
          'flex-1',
          index === reading.active
            ? [text[band.tone], 'font-medium']
            : 'text-text-muted dark:text-text-dark-muted',
        ]"
      >
        {{ band.label }}
        <span v-if="band.up_to !== null" class="whitespace-nowrap opacity-70">
          ≤ {{ formatReading(band.up_to, reading.format, true) }}
        </span>
      </span>
    </div>
  </div>
</template>
