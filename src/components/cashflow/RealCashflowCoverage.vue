<script setup lang="ts">
/** The accounts whose history leaves part of the period out: a transfer to one there cannot pair, and counts as spent. */
import { AlertTriangle } from 'lucide-vue-next'

import { useFormatters } from '@/composables/useFormatters'
import { coverageNotice } from '@/utils/realCashflow'
import type { RealCashflowCoverageGap } from '@/types'

defineProps<{ gaps: RealCashflowCoverageGap[] }>()

const { formatDate } = useFormatters()
</script>

<template>
  <ul v-if="gaps.length" class="space-y-1">
    <li
      v-for="gap in gaps"
      :key="gap.account_id"
      class="flex items-start gap-1.5 text-xs text-text-muted dark:text-text-dark-muted"
    >
      <AlertTriangle class="w-3.5 h-3.5 mt-px shrink-0 text-warning" />
      <span>
        {{ coverageNotice(gap, formatDate) }}
        <router-link :to="{ name: 'bank' }" class="font-medium text-primary hover:underline">Importer un relevé</router-link>
      </span>
    </li>
  </ul>
</template>
