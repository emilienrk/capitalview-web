<script setup lang="ts">
/**
 * A reading condition, said in a few words with the full sentence behind it.
 *
 * It replaces the paragraphs that used to sit under the figures: the chip keeps
 * the condition visible, the tooltip keeps the explanation one tap away.
 */
import { Info } from 'lucide-vue-next'
import BaseTooltip from '@/components/base/BaseTooltip.vue'

defineProps<{ label: string }>()
</script>

<template>
  <BaseTooltip :label="label">
    <template #trigger>
      <span
        class="inline-flex items-center gap-1 rounded-full bg-surface-active px-2 py-0.5 text-[11px] text-text-muted dark:bg-surface-dark-active dark:text-text-dark-muted"
      >
        <Info class="h-3 w-3" stroke-width="2" />
        {{ label }}
      </span>
    </template>
    <slot />
  </BaseTooltip>
</template>
