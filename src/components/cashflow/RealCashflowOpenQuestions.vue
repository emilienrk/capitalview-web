<script setup lang="ts">
/** Said above the figures while answers in Opérations can still move them. */
import { computed } from 'vue'
import { HelpCircle } from 'lucide-vue-next'

import { useBankStore } from '@/stores/bank'
import { openQuestionsNotice } from '@/utils/realCashflow'

const props = defineProps<{ count: number }>()

const bank = useBankStore()
const notice = computed(() => openQuestionsNotice(props.count))
/** The most recent month holding a question: Opérations lists the others from there. */
const latest = computed(() => {
  const months = bank.transferQuestions?.months ?? []
  return months[months.length - 1]?.period
})
</script>

<template>
  <div
    v-if="notice"
    class="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-card border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-text-main dark:text-text-dark-main"
  >
    <HelpCircle class="w-4 h-4 shrink-0 text-warning" />
    <span>{{ notice }}</span>
    <router-link
      :to="{ name: 'bank-transactions', query: { period: latest, review: '1' } }"
      class="font-medium text-warning hover:underline"
    >
      Les voir dans Opérations
    </router-link>
  </div>
</template>
