<script setup lang="ts">
import type { Component } from 'vue'
import { BaseCard } from '@/components'

interface Props {
  icon: Component
  title: string
  /** Small line under the title, inside the header. */
  subtitle?: string
  /** Shown in the body, above the slot content. */
  description?: string
}

defineProps<Props>()
</script>

<template>
  <BaseCard>
    <template #header>
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-8 h-8 rounded-secondary bg-primary/10 flex items-center justify-center shrink-0">
            <component :is="icon" class="w-4 h-4 text-primary" :stroke-width="2" />
          </div>
          <div class="min-w-0">
            <h3 class="text-lg font-semibold text-text-main dark:text-text-dark-main">{{ title }}</h3>
            <p v-if="subtitle" class="text-xs text-text-muted dark:text-text-dark-muted mt-0.5">
              {{ subtitle }}
            </p>
          </div>
        </div>
        <slot name="header-action" />
      </div>
    </template>
    <p v-if="description" class="text-sm text-text-muted dark:text-text-dark-muted mb-4">
      {{ description }}
    </p>
    <slot />
    <template v-if="$slots.footer" #footer>
      <slot name="footer" />
    </template>
  </BaseCard>
</template>
