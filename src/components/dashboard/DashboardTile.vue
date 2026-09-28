<script setup lang="ts">
/**
 * One figure with its source underneath, leading to the page that details it.
 * The note says where the number comes from: a tile that cannot say it should
 * not be on the dashboard.
 */
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import { BaseSkeleton } from '@/components'

defineProps<{
  label: string
  value: string
  detail?: string
  detailClass?: string
  note?: string
  to?: RouteLocationRaw
  loading?: boolean
}>()
</script>

<template>
  <component
    :is="to ? RouterLink : 'div'"
    :to="to"
    class="group block rounded-card border border-surface-border bg-surface p-3.5 shadow-soft sm:p-4 transition-colors dark:border-surface-dark-border dark:bg-surface-dark"
    :class="to ? 'hover:border-primary/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary' : ''"
  >
    <p class="truncate text-sm font-medium text-text-muted dark:text-text-dark-muted">{{ label }}</p>
    <template v-if="loading">
      <BaseSkeleton variant="rect" width="70%" height="1.5rem" class="mt-2" />
      <BaseSkeleton variant="rect" width="50%" height="0.75rem" class="mt-2" />
    </template>
    <template v-else>
      <p class="cv-figure mt-1 truncate text-lg font-bold sm:text-xl tabular-nums text-text-main dark:text-text-dark-main">
        {{ value }}
      </p>
      <p v-if="detail" class="mt-0.5 text-xs font-medium tabular-nums sm:text-sm" :class="detailClass || 'text-text-muted dark:text-text-dark-muted'">
        {{ detail }}
      </p>
      <p v-if="note" class="mt-1 text-xs text-text-muted dark:text-text-dark-muted">{{ note }}</p>
    </template>
  </component>
</template>
