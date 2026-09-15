<script setup lang="ts">
/** One nature's categories, largest first, each with its share of the whole. */
import { computed } from 'vue'

import type { RealCashflowCategoryShare } from '@/types'

const props = defineProps<{
  shares: RealCashflowCategoryShare[]
  format: (value: number) => string
  barClass: string
  empty: string
}>()

const total = computed(() => props.shares.reduce((sum, s) => sum + Math.max(0, Number(s.amount)), 0))

function width(share: RealCashflowCategoryShare): string {
  return total.value > 0 ? `${Math.max(0, (Number(share.amount) / total.value) * 100)}%` : '0'
}
</script>

<template>
  <ul v-if="shares.length" class="space-y-3">
    <li v-for="share in shares" :key="share.category_id ?? 'none'">
      <div class="flex items-baseline justify-between gap-3 text-sm">
        <span :class="['truncate', share.category_id ? 'text-text-main dark:text-text-dark-main' : 'text-text-muted dark:text-text-dark-muted italic']">
          {{ share.name }}
          <span class="text-xs text-text-muted dark:text-text-dark-muted not-italic">· {{ share.count }}</span>
        </span>
        <span class="shrink-0 font-semibold tabular-nums text-text-main dark:text-text-dark-main">{{ format(share.amount) }}</span>
      </div>
      <div class="mt-1 h-1.5 rounded-full bg-background-subtle dark:bg-background-dark-subtle overflow-hidden">
        <div :class="['h-full rounded-full', barClass]" :style="{ width: width(share) }" />
      </div>
    </li>
  </ul>
  <p v-else class="text-sm text-text-muted dark:text-text-dark-muted text-center py-4">{{ empty }}</p>
</template>
