<script setup lang="ts">
/** Said above the figures while answers can still move them, in euros first. */
import { computed } from 'vue'
import { HelpCircle } from 'lucide-vue-next'

import { useFormatters } from '@/composables/useFormatters'
import { usePrivacyMode } from '@/composables/usePrivacyMode'
import { openQuestionsNotice } from '@/utils/realCashflow'

const props = defineProps<{
  count: number
  amount: number
  currency: string
  /** The year shown: the queue opens on its questions. */
  year?: number
}>()

const { formatCurrency } = useFormatters()
const { maskValue } = usePrivacyMode()
const notice = computed(() => openQuestionsNotice(props.count, maskValue(formatCurrency(Number(props.amount), props.currency))))
</script>

<template>
  <div
    v-if="notice"
    class="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-card border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-text-main dark:text-text-dark-main"
  >
    <HelpCircle class="w-4 h-4 shrink-0 text-warning" />
    <span>{{ notice }}</span>
    <router-link
      :to="{ name: 'bank-review', query: year ? { year: String(year) } : {} }"
      class="font-medium text-warning hover:underline"
    >
      Trier, les plus gros montants d'abord
    </router-link>
  </div>
</template>
