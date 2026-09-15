<script setup lang="ts">
/** One operation in the Opérations tab, grouped under its day or listed by amount. */
import { ArrowLeftRight } from 'lucide-vue-next'

import { BaseBadge } from '@/components'
import type { BankTransactionItem } from '@/types'

defineProps<{
  tx: BankTransactionItem
  /** Shown only when the list is not already grouped by day. */
  date?: string
  showAccount: boolean
  amount: string
  amountClass: string
}>()
</script>

<template>
  <li :class="['flex items-center gap-3 px-4 sm:px-6 py-3', tx.is_pending ? 'opacity-70' : '']">
    <div class="min-w-0 flex-1">
      <p class="truncate text-sm font-medium text-text-main dark:text-text-dark-main" :title="tx.label ?? undefined">
        {{ tx.label ?? 'Opération sans libellé' }}
      </p>
      <div class="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-text-muted dark:text-text-dark-muted">
        <span v-if="date">{{ date }}</span>
        <span v-if="date && showAccount" aria-hidden="true">·</span>
        <span v-if="showAccount">{{ tx.account_name }}</span>
        <BaseBadge v-if="tx.transfer_account_name" variant="info">
          <ArrowLeftRight class="inline w-3 h-3 mr-1 -mt-px" />
          {{ tx.is_credit ? 'depuis' : 'vers' }} {{ tx.transfer_account_name }}
        </BaseBadge>
        <BaseBadge v-if="tx.is_pending" variant="warning">En attente</BaseBadge>
      </div>
    </div>
    <p :class="['shrink-0 text-sm font-semibold tabular-nums', amountClass]">
      {{ amount }}
    </p>
  </li>
</template>
