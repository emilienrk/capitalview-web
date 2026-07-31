<script setup lang="ts">
/**
 * The page's opening statement.
 *
 * The API writes it from gated figures only, so this component never decides
 * what may be said — it only makes sure the sentence is read before the charts.
 */
defineProps<{ verdict: string }>()
</script>

<template>
  <section
    class="mb-8 rounded-xl border-l-4 border-primary bg-surface px-5 py-4 dark:bg-surface-dark"
  >
    <p
      class="mb-1 text-[11px] font-medium uppercase tracking-wider text-text-muted dark:text-text-dark-muted"
    >
      Verdict
    </p>
    <p class="text-base leading-relaxed text-text-main dark:text-text-dark-main">
      {{ verdict }}
    </p>
  </section>
</template>
