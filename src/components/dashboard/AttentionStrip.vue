<script setup lang="ts">
/**
 * What is waiting on the owner — operations to sort, a broken bank link —
 * shown only while something is. An empty strip would teach the eye to skip it.
 */
import { RouterLink } from 'vue-router'
import { AlertTriangle, ChevronRight } from 'lucide-vue-next'
import type { AttentionItem } from '@/composables/useDashboardOverview'

defineProps<{ items: AttentionItem[] }>()
</script>

<template>
  <nav v-if="items.length" aria-label="À traiter">
    <!-- One list on a phone, one row of chips on a wider screen. -->
    <ul
      class="divide-y divide-surface-border overflow-hidden rounded-card border border-surface-border bg-surface dark:divide-surface-dark-border dark:border-surface-dark-border dark:bg-surface-dark sm:flex sm:flex-wrap sm:gap-2 sm:divide-y-0 sm:overflow-visible sm:rounded-none sm:border-0 sm:bg-transparent sm:dark:bg-transparent"
    >
      <li v-for="item in items" :key="item.key">
        <RouterLink
          :to="item.to"
          class="flex min-h-11 items-center gap-2 px-4 py-2.5 text-sm font-medium text-text-main transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary dark:text-text-dark-main sm:min-h-0 sm:rounded-button sm:border sm:px-3 sm:py-2"
          :class="item.urgent
            ? 'bg-warning/10 sm:border-warning/40 sm:hover:border-warning'
            : 'sm:border-surface-border sm:bg-surface sm:hover:border-primary/40 sm:dark:border-surface-dark-border sm:dark:bg-surface-dark'"
        >
          <AlertTriangle v-if="item.urgent" class="h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
          <span class="min-w-0 flex-1">{{ item.label }}</span>
          <ChevronRight class="h-4 w-4 shrink-0 text-text-muted dark:text-text-dark-muted" aria-hidden="true" />
        </RouterLink>
      </li>
    </ul>
  </nav>
</template>
