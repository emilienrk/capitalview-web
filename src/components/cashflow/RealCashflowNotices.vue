<script setup lang="ts">
/**
 * What can still move the figures, in one block: the operations left to
 * confirm, the recurring payments and income found but not confirmed yet, and
 * the accounts whose history leaves part of the period out — a transfer to one
 * there cannot pair, and counts as spent.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { AlertTriangle, HelpCircle, Repeat } from 'lucide-vue-next'

import { useFormatters } from '@/composables/useFormatters'
import { usePrivacyMode } from '@/composables/usePrivacyMode'
import { useBankStore } from '@/stores/bank'
import { coverageNotice, openQuestionsNotice, recurringToConfirmNotice } from '@/utils/realCashflow'
import type { RealCashflowCoverageGap } from '@/types'

const props = defineProps<{
  count: number
  amount: number
  currency: string
  gaps: RealCashflowCoverageGap[]
  /** The year shown: the queue opens on its questions. */
  year?: number
}>()

const bank = useBankStore()
const { formatCurrency, formatDate } = useFormatters()
const { maskValue } = usePrivacyMode()

const questions = computed(() => openQuestionsNotice(props.count, maskValue(formatCurrency(Number(props.amount), props.currency))))
// Across the whole history, as the Récurrents tab's badge: a series is not a year's.
const recurring = computed(() => recurringToConfirmNotice(bank.transferQuestions?.recurring ?? 0))

onMounted(() => {
  if (!bank.transferQuestions) void bank.fetchTransferQuestions()
})
watch(() => bank.dataRevision, () => void bank.fetchTransferQuestions())
const confirming = ref<string | null>(null)

async function confirm(accountId: string): Promise<void> {
  confirming.value = accountId
  await bank.confirmUpToDate(accountId)
  confirming.value = null
}
</script>

<template>
  <ul
    v-if="questions || recurring || gaps.length"
    class="space-y-1.5 rounded-card border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-text-main dark:text-text-dark-main"
  >
    <li v-if="questions" class="flex items-start gap-2">
      <HelpCircle class="w-4 h-4 mt-0.5 shrink-0 text-warning" />
      <p>
        {{ questions }}
        <router-link
          :to="{ name: 'bank-review', query: year ? { year: String(year) } : {} }"
          class="ml-1 font-medium text-warning hover:underline"
        >
          Trier
        </router-link>
      </p>
    </li>
    <li v-if="recurring" class="flex items-start gap-2">
      <Repeat class="w-4 h-4 mt-0.5 shrink-0 text-warning" />
      <p>
        {{ recurring }}
        <router-link :to="{ name: 'bank-recurring' }" class="ml-1 font-medium text-warning hover:underline">Valider</router-link>
      </p>
    </li>
    <li v-for="gap in gaps" :key="gap.account_id" class="flex items-start gap-2">
      <AlertTriangle class="w-4 h-4 mt-0.5 shrink-0 text-warning" />
      <p>
        {{ coverageNotice(gap, formatDate) }}
        <router-link :to="{ name: 'bank' }" class="ml-1 font-medium text-warning hover:underline">Importer un relevé</router-link>
        <!-- A quiet account is not a stale one: the user can say so. -->
        <button
          v-if="gap.ends_early"
          type="button"
          class="ml-2 font-medium text-text-muted dark:text-text-dark-muted hover:underline disabled:opacity-50"
          :disabled="confirming === gap.account_id"
          @click="confirm(gap.account_id)"
        >
          Rien de nouveau depuis
        </button>
      </p>
    </li>
  </ul>
</template>
