<script setup lang="ts">
/**
 * The page's opening board: one line per block, what is off first.
 *
 * It replaces a paragraph of verdict. The API ranks the lines and colours them
 * from the same bands the blocks draw, so the board can never disagree with the
 * scale further down. A bar is drawn only for lines that carry euros, scaled to
 * the largest one: how much each finding weighs is visible before it is read.
 */
import { computed } from 'vue'
import { useFormatters } from '@/composables/useFormatters'
import { usePrivacyMode } from '@/composables/usePrivacyMode'
import { useReadingFormat } from '@/composables/useReadingFormat'
import type { SignalOut } from '@/types'

const props = defineProps<{ signals: SignalOut[] }>()

const { formatCurrency } = useFormatters()
const { maskValue } = usePrivacyMode()
const { formatReading } = useReadingFormat()

const dot: Record<SignalOut['tone'], string> = {
  good: 'bg-success',
  watch: 'bg-warning',
  bad: 'bg-danger',
  neutral: 'bg-text-muted dark:bg-text-dark-muted',
}

const text: Record<SignalOut['tone'], string> = {
  good: 'text-success',
  watch: 'text-warning',
  bad: 'text-danger',
  neutral: 'text-text-muted dark:text-text-dark-muted',
}

const largest = computed(() =>
  Math.max(0, ...props.signals.map((signal) => Math.abs(Number(signal.eur ?? 0)))),
)

function figure(signal: SignalOut): string {
  if (signal.eur !== null) {
    const amount = Number(signal.eur)
    return maskValue(`${amount > 0 ? '+' : ''}${formatCurrency(amount)}`)
  }
  const value = signal.format ? formatReading(signal.value, signal.format) : ''
  return signal.tone === 'neutral' ? `${value} · hasard` : value
}

function barWidth(signal: SignalOut): number {
  if (signal.eur === null || !largest.value) return 0
  return (Math.abs(Number(signal.eur)) / largest.value) * 100
}

function goTo(block: string) {
  document.getElementById(`analyse-${block}`)?.scrollIntoView({ behavior: 'smooth' })
}
</script>

<template>
  <section
    class="mb-8 rounded-card border border-surface-border bg-surface px-2 py-1 dark:border-surface-dark-border dark:bg-surface-dark"
  >
    <ul class="divide-y divide-surface-border dark:divide-surface-dark-border">
      <li v-for="signal in signals" :key="`${signal.block}-${signal.label}`">
        <button
          type="button"
          class="grid w-full grid-cols-[auto_1fr_auto] items-center gap-x-3 rounded-md px-2 py-2 text-left hover:bg-surface-hover dark:hover:bg-surface-dark-hover sm:grid-cols-[auto_12rem_1fr_auto]"
          @click="goTo(signal.block)"
        >
          <span :class="['h-2.5 w-2.5 rounded-full', dot[signal.tone]]" />
          <span class="truncate text-sm text-text-main dark:text-text-dark-main">
            {{ signal.label }}
          </span>
          <!-- On a phone the bar drops under the label: squeezed between label
               and figure it truncated the one and varied in width row to row. -->
          <span
            :class="[
              'order-last col-span-2 col-start-2 mt-1.5 h-1.5 rounded-full bg-background-subtle dark:bg-background-dark-subtle sm:order-none sm:col-span-1 sm:col-start-auto sm:mt-0',
              barWidth(signal) ? '' : 'hidden sm:block',
            ]"
          >
            <span
              v-if="barWidth(signal)"
              :class="['block h-full rounded-full', dot[signal.tone]]"
              :style="{ width: `${Math.max(barWidth(signal), 2)}%` }"
            />
          </span>
          <span
            :class="[
              'whitespace-nowrap text-right text-sm font-semibold tabular-nums',
              text[signal.tone],
            ]"
          >
            {{ figure(signal) }}
          </span>
        </button>
      </li>
    </ul>
  </section>
</template>
