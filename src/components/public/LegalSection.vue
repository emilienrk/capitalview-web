<script setup lang="ts">
defineProps<{ heading: string }>()
</script>

<template>
  <section
    class="py-8 border-t border-text-main/15 dark:border-text-dark-main/15
      [&_a]:rounded-button [&_a]:font-semibold [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_a]:break-words
      [&_a:focus-visible]:outline-2 [&_a:focus-visible]:outline-offset-2 [&_a:focus-visible]:outline-primary
      [&_strong]:font-semibold [&_strong]:text-text-main dark:[&_strong]:text-text-dark-main
      [&_ul]:space-y-3 [&_ul]:pl-5 [&_ul]:list-disc [&_li]:pl-1 [&_li]:marker:text-text-muted"
  >
    <h2 class="text-2xl font-semibold text-text-main dark:text-text-dark-main text-balance">{{ heading }}</h2>
    <div class="mt-4 space-y-4 leading-relaxed text-pretty">
      <slot />
    </div>
  </section>
</template>
