<script setup lang="ts">
import type { SummaryStatItem } from '@/composables/useStatsPager'

/**
 * A crypto account's stat tiles, four per page. Shared by the single-wallet
 * page and the expanded wallet of the multi-wallet view, which sits inside a
 * card and so takes the inset look.
 */
defineProps<{
  stats: SummaryStatItem[]
  pageCount: number
  inset?: boolean
}>()

const page = defineModel<number>('page', { required: true })
</script>

<template>
  <div class="space-y-3">
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <component
        :is="stat.onSelect ? 'button' : 'div'"
        v-for="stat in stats"
        :key="stat.key"
        :type="stat.onSelect ? 'button' : undefined"
        :class="[
          'flex flex-col rounded-secondary border border-surface-border dark:border-surface-dark-border text-left w-full',
          inset ? 'bg-background-subtle dark:bg-background-dark-subtle p-3.5' : 'bg-surface dark:bg-surface-dark p-4',
          stat.onSelect ? 'cursor-pointer hover:border-primary/60 transition-colors' : '',
        ]"
        @click="stat.onSelect?.()"
      >
        <p :class="['text-[11px] font-medium uppercase tracking-wider text-text-muted dark:text-text-dark-muted', inset ? 'mb-1' : 'mb-1.5']">{{ stat.label }}</p>
        <p :class="[inset ? 'text-lg' : 'text-xl', 'font-bold tabular-nums', stat.valueClass ?? 'text-text-main dark:text-text-dark-main']">
          <span v-if="stat.prefix" class="mr-1 text-xs font-semibold text-text-muted dark:text-text-dark-muted">{{ stat.prefix }}</span>{{ stat.value }}
        </p>
        <p v-if="stat.note" class="mt-1.5 text-[11px] leading-snug text-text-muted dark:text-text-dark-muted">{{ stat.note }}</p>
      </component>
    </div>

    <div v-if="pageCount > 1" class="flex items-center justify-center gap-2">
      <button
        v-for="index in pageCount"
        :key="index"
        type="button"
        :aria-label="`Afficher le groupe de statistiques ${index}`"
        class="h-2.5 w-2.5 rounded-full transition-colors"
        :class="index - 1 === page ? 'bg-primary' : 'bg-surface-active dark:bg-surface-dark-active hover:bg-primary/40'"
        @click="page = index - 1"
      />
    </div>
  </div>
</template>
