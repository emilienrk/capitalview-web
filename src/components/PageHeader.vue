<script setup lang="ts">
interface Props {
  title: string
  description?: string
  /** Icon-only actions: small enough to stay on the title row at every width. */
  inlineActions?: boolean
}

defineProps<Props>()
</script>

<template>
  <div class="mb-6 sm:mb-8">
    <div
      class="flex gap-3 sm:items-start sm:justify-between sm:gap-4"
      :class="inlineActions ? 'flex-row items-start justify-between' : 'flex-col sm:flex-row'"
    >
      <div class="min-w-0">
        <h1 class="text-xl sm:text-2xl font-bold text-text-main dark:text-text-dark-main">{{ title }}</h1>
        <p v-if="description" class="mt-1 text-sm text-text-muted dark:text-text-dark-muted">
          {{ description }}
        </p>
      </div>
      <!-- Actions wrap onto their own rows below the title on narrow screens;
           keeping them on the title row squeezes it to one word per line. -->
      <div v-if="$slots.actions" class="flex flex-wrap items-center gap-2 sm:gap-3" :class="inlineActions ? 'shrink-0' : 'sm:shrink-0'">
        <slot name="actions" />
      </div>
    </div>
  </div>
</template>
