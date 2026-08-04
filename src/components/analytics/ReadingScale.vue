<script setup lang="ts">
/**
 * Where a figure sits on the scale the page itself judges it by.
 *
 * "20 bps" means nothing without knowing that the line is drawn at 25. Every
 * threshold shown here is the one the API actually uses to write its verdict —
 * none is invented for display, because a scale that disagrees with the sentence
 * underneath it is worse than no scale.
 *
 * The last band has no `upTo`: it runs to infinity.
 */
import { computed } from 'vue'

type Tone = 'good' | 'watch' | 'bad'

const props = defineProps<{
  value?: number | string | null
  bands: { upTo?: number; label: string; tone: Tone }[]
  /** Renders the reading marker. Defaults to a plain number. */
  format?: (value: number) => string
}>()

const numeric = computed(() => {
  if (props.value === null || props.value === undefined || props.value === '') return null
  const parsed = Number(props.value)
  return Number.isFinite(parsed) ? parsed : null
})

/** The first band whose ceiling the value has not passed. */
const activeIndex = computed(() => {
  if (numeric.value === null) return -1
  return props.bands.findIndex((band) => band.upTo === undefined || numeric.value! <= band.upTo)
})

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

const reading = computed(() => {
  if (numeric.value === null) return null
  return props.format ? props.format(numeric.value) : String(numeric.value)
})
</script>

<template>
  <div class="mt-1">
    <div class="flex gap-0.5">
      <span
        v-for="(band, index) in bands"
        :key="band.label"
        :class="[
          'h-1 flex-1 rounded-full',
          fill[band.tone],
          index === activeIndex ? 'opacity-100' : 'opacity-25',
        ]"
      />
    </div>
    <div class="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
      <span
        v-for="(band, index) in bands"
        :key="band.label"
        :class="index === activeIndex ? [text[band.tone], 'font-medium'] : 'text-text-muted dark:text-text-dark-muted'"
      >
        {{ band.label }}
      </span>
    </div>
    <p v-if="reading" class="mt-0.5 text-[11px] text-text-muted dark:text-text-dark-muted">
      Toi : <span class="font-medium tabular-nums">{{ reading }}</span>
    </p>
  </div>
</template>
