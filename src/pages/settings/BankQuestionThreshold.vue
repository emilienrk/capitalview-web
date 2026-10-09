<script setup lang="ts">
/**
 * The amount past which an expense nothing explains is asked about in « À
 * trier » (docs/bank-sorting.md in the API). Moving the slider shows at once
 * what it would ask; releasing it saves.
 */
import { HelpCircle } from 'lucide-vue-next'
import { computed, onMounted, ref, watch } from 'vue'

import { apiClient } from '@/api/client'
import { BaseHelpPopover } from '@/components'
import { useFormatters } from '@/composables/useFormatters'
import { usePrivacyMode } from '@/composables/usePrivacyMode'
import type { BankQuestionThreshold } from '@/types'
import { THRESHOLD_STEPS as STEPS, askedAt, nearestStep } from '@/utils/questionThreshold'

const props = defineProps<{ threshold: number }>()
const emit = defineEmits<{ save: [threshold: number] }>()

const { formatCurrency } = useFormatters()
const { maskValue } = usePrivacyMode()

const position = ref(nearestStep(props.threshold))
watch(() => props.threshold, (value) => { position.value = nearestStep(value) })
const value = computed(() => STEPS[position.value]!)

const amounts = ref<number[] | null>(null)
const failed = ref(false)

onMounted(async () => {
  try {
    const preview = await apiClient.get<BankQuestionThreshold>('/banking/question-threshold')
    amounts.value = preview.amounts.map(Number)
  } catch {
    failed.value = true
  }
})

const asked = computed(() => (amounts.value ? askedAt(amounts.value, value.value) : null))

/** The threshold is a setting, not a figure of the user's: only totals hide. */
function threshold(amount: number): string {
  return formatCurrency(amount).replace(/[,.]00(?=\s|$)/, '')
}
</script>

<template>
  <div class="space-y-2">
    <div class="flex items-center gap-1">
      <HelpCircle class="w-4 h-4 shrink-0 text-text-muted dark:text-text-dark-muted" />
      <label for="bank-question-threshold" class="text-sm font-medium text-text-main dark:text-text-dark-main">
        Dépenses à vérifier à partir de {{ threshold(value) }}
      </label>
      <BaseHelpPopover width="md">
        Une dépense que rien n'explique (ni virement vers un de vos comptes, ni versement sur un compte
        d'investissement) compte comme une dépense. Au-delà de ce montant, elle est aussi posée dans « À trier » :
        c'est là qu'on repère un virement vers un compte que vous n'avez pas ajouté. Plus bas, plus de questions
        et plus de précision.
      </BaseHelpPopover>
    </div>
    <input
      id="bank-question-threshold"
      v-model.number="position"
      type="range"
      min="0"
      :max="STEPS.length - 1"
      step="1"
      class="w-full accent-primary"
      :aria-valuetext="threshold(value)"
      @change="emit('save', value)"
    />
    <p class="text-sm text-text-muted dark:text-text-dark-muted tabular-nums" aria-live="polite">
      <template v-if="asked">
        <template v-if="asked.count === 0">Aucune dépense de votre historique ne serait posée.</template>
        <template v-else>
          {{ asked.count }} dépense{{ asked.count > 1 ? 's' : '' }} de votre historique
          {{ asked.count > 1 ? 'seraient posées' : 'serait posée' }}, {{ maskValue(formatCurrency(asked.total)) }} en tout.
        </template>
      </template>
      <template v-else-if="failed">L'aperçu n'a pas pu être chargé.</template>
      <template v-else>Calcul de l'aperçu…</template>
    </p>
  </div>
</template>
