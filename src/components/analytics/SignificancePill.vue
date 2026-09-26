<script setup lang="ts">
/**
 * The permutation test, as a word instead of a p-value.
 *
 * Above p = 0,10 the pattern is indistinguishable from chance and says so; the
 * number itself stays behind the pill for whoever wants it.
 */
import BaseTooltip from '@/components/base/BaseTooltip.vue'

defineProps<{ detectable: boolean; pValue: number | string | null }>()
</script>

<template>
  <BaseTooltip v-if="pValue !== null" :label="detectable ? 'Significatif' : 'Hasard'">
    <template #trigger>
      <span
        :class="[
          'rounded-full px-2 py-0.5 text-[11px] font-medium',
          detectable
            ? 'bg-primary-light text-primary dark:bg-primary/20'
            : 'bg-surface-active text-text-muted dark:bg-surface-dark-active dark:text-text-dark-muted',
        ]"
      >
        {{ detectable ? 'Significatif' : 'Hasard' }}
      </span>
    </template>
    Tes achats re-tirés au hasard 5 000 fois : p = {{ Number(pValue).toFixed(3) }}.
    <template v-if="!detectable">Au-delà de 0,10, l'écart est indiscernable du hasard.</template>
  </BaseTooltip>
</template>
