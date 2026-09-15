<script setup lang="ts">
/**
 * The Banque section's two views. Routes rather than in-page state, so an
 * account's operations can be linked to and survive a reload.
 */
import { ArrowLeftRight, Wallet } from 'lucide-vue-next'
import { useRoute } from 'vue-router'

const route = useRoute()

const tabs = [
  { name: 'bank', label: 'Comptes', icon: Wallet },
  { name: 'bank-transactions', label: 'Opérations', icon: ArrowLeftRight },
] as const
</script>

<template>
  <nav class="mb-6 flex gap-1 border-b border-surface-border dark:border-surface-dark-border">
    <router-link
      v-for="tab in tabs"
      :key="tab.name"
      :to="{ name: tab.name }"
      :class="[
        '-mb-px flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors duration-150',
        route.name === tab.name
          ? 'border-primary text-primary'
          : 'border-transparent text-text-muted dark:text-text-dark-muted hover:text-text-main dark:hover:text-text-dark-main',
      ]"
    >
      <component :is="tab.icon" class="w-4 h-4" :stroke-width="1.75" />
      {{ tab.label }}
    </router-link>
  </nav>
</template>
