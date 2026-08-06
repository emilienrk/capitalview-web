<script setup lang="ts">
/**
 * How far a figure can be trusted — shown only when that is a warning.
 *
 * A "Fiable" badge under every number was noise: it is the expected case, and
 * repeating it thirty times taught the reader to skip the badges entirely,
 * including the ones that mattered. Solid figures now carry nothing.
 *
 * A degraded figure keeps a marker, because reading "1.1 paris indépendants" as
 * a measurement rather than a noisy estimate is a wrong conclusion, not a
 * cosmetic detail. The sentence explaining why sits behind it — hover on a
 * pointer, tap on a phone.
 */
import { computed } from 'vue'
import { CircleAlert, Sigma, TriangleAlert } from 'lucide-vue-next'
import BaseTooltip from '@/components/base/BaseTooltip.vue'
import type { Reliability } from '@/types'

const props = defineProps<{ reliability: Reliability; caveat?: string | null }>()

const isSolid = computed(() => props.reliability === 'solide')

const label = computed(
  () =>
    ({
      solide: 'Fiable',
      indicatif: 'Indicatif',
      // Not a degraded reading — a figure that was computed rather than read.
      // Its own marker, because "estimated" and "noisy" are different warnings.
      estimé: 'Estimé',
      insuffisant: 'Données insuffisantes',
    })[props.reliability] ?? '',
)

const tone = computed(() =>
  props.reliability === 'indicatif'
    ? 'text-warning'
    : 'text-text-muted dark:text-text-dark-muted',
)

const icon = computed(() => {
  if (props.reliability === 'indicatif') return TriangleAlert
  if (props.reliability === 'estimé') return Sigma
  return CircleAlert
})
</script>

<template>
  <BaseTooltip v-if="!isSolid" :label="label">
    <template #trigger>
      <component :is="icon" :class="['h-3.5 w-3.5', tone]" stroke-width="2" />
    </template>
    <span class="font-medium text-text-main dark:text-text-dark-main">{{ label }}</span>
    <template v-if="caveat"> — {{ caveat }}</template>
  </BaseTooltip>
</template>
