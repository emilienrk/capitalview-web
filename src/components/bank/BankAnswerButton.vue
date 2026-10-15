<script setup lang="ts">
/**
 * A short answer to a question the bank lists ask in place — a type, Oui/Non,
 * Ensemble. Smaller than `BaseButton`, in the warning tone of the question it
 * answers; `muted` for the answer that leaves things as they were.
 */
withDefaults(defineProps<{ muted?: boolean }>(), { muted: false })
</script>

<template>
  <button
    type="button"
    :class="[
      'px-3 py-1.5 sm:px-2 sm:py-0.5 rounded-button font-medium disabled:opacity-50 transition-[background-color,scale] duration-150 ease-out enabled:active:scale-[0.97]',
      muted
        ? 'bg-background-subtle dark:bg-background-dark-subtle text-text-main dark:text-text-dark-main hover:bg-surface-border dark:hover:bg-surface-dark-border'
        : 'bg-warning/10 text-warning hover:bg-warning/20',
    ]"
  >
    <slot />
  </button>
</template>
