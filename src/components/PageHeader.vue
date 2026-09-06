<script setup lang="ts">
interface Props {
  title: string
  description?: string
}

defineProps<Props>()
</script>

<template>
  <div class="mb-6 sm:mb-8">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div class="min-w-0">
        <h1 class="text-xl sm:text-2xl font-bold text-text-main dark:text-text-dark-main">{{ title }}</h1>
        <p v-if="description" class="mt-1 text-sm text-text-muted dark:text-text-dark-muted">
          {{ description }}
        </p>
      </div>
      <!-- Actions wrap onto their own rows below the title on narrow screens;
           keeping them on the title row squeezes it to one word per line. -->
      <div v-if="$slots.actions" class="flex flex-wrap items-center gap-2 sm:gap-3 sm:shrink-0">
        <slot name="actions" />
      </div>
    </div>
  </div>
</template>
