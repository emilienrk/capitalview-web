<script setup lang="ts">
import type { Component } from 'vue'
import { ref, watch } from 'vue'
import { ChevronDown } from 'lucide-vue-next'

interface Props {
  title: string
  /** Small line under the title, always visible. */
  subtitle?: string
  icon?: Component
  /** Open on first render. Changing it later re-applies, so a parent can open
      the panel when its own state makes the content newly relevant. */
  defaultOpen?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  subtitle: undefined,
  icon: undefined,
  defaultOpen: false,
})

const isOpen = ref(props.defaultOpen)

watch(() => props.defaultOpen, (open) => {
  isOpen.value = open
})
</script>

<template>
  <div class="rounded-card border border-surface-border dark:border-surface-dark-border overflow-hidden">
    <button
      type="button"
      class="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-background-subtle dark:hover:bg-background-dark-subtle"
      :aria-expanded="isOpen"
      @click="isOpen = !isOpen"
    >
      <span
        v-if="props.icon"
        class="w-8 h-8 rounded-secondary bg-primary/10 flex items-center justify-center shrink-0"
      >
        <component :is="props.icon" class="w-4 h-4 text-primary" :stroke-width="2" />
      </span>
      <span class="min-w-0 flex-1">
        <span class="block text-sm font-semibold text-text-main dark:text-text-dark-main">
          {{ props.title }}
        </span>
        <span v-if="props.subtitle" class="block text-xs text-text-muted dark:text-text-dark-muted mt-0.5">
          {{ props.subtitle }}
        </span>
      </span>
      <ChevronDown
        :class="[
          'w-4 h-4 shrink-0 text-text-muted dark:text-text-dark-muted transition-transform duration-150',
          isOpen ? 'rotate-180' : '',
        ]"
      />
    </button>
    <div v-if="isOpen" class="px-4 pb-4 pt-1">
      <slot />
    </div>
  </div>
</template>
