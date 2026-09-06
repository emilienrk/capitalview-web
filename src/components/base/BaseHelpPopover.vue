<script setup lang="ts">
/**
 * The "?" that carries a definition, a method note or a caveat.
 *
 * One affordance for the whole app: three had grown side by side, each with a
 * different hit target and a different way of closing. The style is the one
 * that was furthest along — a real 24px button with hover feedback — over the
 * interaction BaseTooltip already had right: pointer opens on hover, touch on
 * tap, keyboard on focus, and a click outside or Escape closes.
 *
 * For secondary reading only. Anything a user must see to avoid a wrong
 * conclusion belongs on the page.
 */
import { CircleQuestionMark } from 'lucide-vue-next'
import BaseTooltip from './BaseTooltip.vue'

withDefaults(
  defineProps<{
    label?: string
    align?: 'left' | 'right'
    width?: 'sm' | 'md'
    placement?: 'top' | 'bottom'
  }>(),
  {
    label: 'En savoir plus',
    align: 'right',
    width: 'sm',
    placement: 'bottom',
  },
)
</script>

<template>
  <BaseTooltip :label="label" :align="align" :width="width" :placement="placement">
    <template #trigger>
      <!-- A span, not a button: BaseTooltip's own button is the control, and
           nesting one inside it would be invalid. -->
      <span
        class="flex h-6 w-6 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-active hover:text-text-main dark:text-text-dark-muted dark:hover:bg-surface-dark-active dark:hover:text-text-dark-main"
      >
        <CircleQuestionMark class="h-4 w-4" :stroke-width="2" />
      </span>
    </template>
    <slot />
  </BaseTooltip>
</template>
