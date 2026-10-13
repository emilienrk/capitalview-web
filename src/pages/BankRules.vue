<script setup lang="ts">
/**
 * The Banque section's Règles tab: what sorts the operations without asking —
 * the user's sorting rules — and the amount past which an expense nothing
 * explains is asked about in « À trier ».
 */
import { onMounted, ref } from 'vue'

import { BaseAlert, BaseCard } from '@/components'
import SortingRules from '@/components/bank/SortingRules.vue'
import BankQuestionThreshold from '@/components/bank/BankQuestionThreshold.vue'
import { useBankStore } from '@/stores/bank'
import { useSettingsStore } from '@/stores/settings'

const settingsStore = useSettingsStore()
const bank = useBankStore()
const error = ref<string | null>(null)

onMounted(() => {
  if (!settingsStore.settings) void settingsStore.fetchSettings()
})

async function saveThreshold(threshold: number): Promise<void> {
  error.value = null
  if (await settingsStore.updateSettings({ bank_question_threshold: threshold })) {
    // The questions it asks change: À trier and its count are read again.
    bank.operationsRead()
  } else {
    error.value = settingsStore.error ?? "Impossible d'enregistrer ce montant."
  }
}
</script>

<template>
  <div class="space-y-6">
    <BaseCard>
      <BaseAlert v-if="error" variant="danger" dismissible class="mb-3" @dismiss="error = null">{{ error }}</BaseAlert>
      <BankQuestionThreshold
        :threshold="settingsStore.settings?.bank_question_threshold ?? 500"
        @save="saveThreshold"
      />
    </BaseCard>
    <SortingRules />
  </div>
</template>
