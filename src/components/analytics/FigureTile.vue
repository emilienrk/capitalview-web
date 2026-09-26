<script setup lang="ts">
/**
 * A figure that carries no reliability of its own — a count, a stored amount.
 *
 * Same shape as MetricTile, so a row mixing the two stays aligned.
 */
defineProps<{ label: string }>()
</script>

<template>
  <div>
    <p
      class="mb-1 text-[11px] font-medium uppercase tracking-wider text-text-muted dark:text-text-dark-muted"
    >
      {{ label }}
    </p>
    <p class="text-2xl font-bold tabular-nums text-text-main dark:text-text-dark-main">
      <slot />
    </p>
  </div>
</template>
