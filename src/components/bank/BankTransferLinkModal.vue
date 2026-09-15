<script setup lang="ts">
/**
 * Binds an operation the pairing left alone: to its other leg on another
 * account, as a transfer, or to its cancellation on the same account — a
 * rejected transfer, a refunded card payment. The candidates are the API's:
 * same amount, opposite direction, a few weeks either side.
 */
import { ref, watch } from 'vue'
import { ArrowLeftRight, Undo2 } from 'lucide-vue-next'

import { BaseAlert, BaseButton, BaseEmptyState, BaseModal, BaseSkeleton } from '@/components'
import { useFormatters } from '@/composables/useFormatters'
import { usePrivacyMode } from '@/composables/usePrivacyMode'
import { useBankStore } from '@/stores/bank'
import type { BankTransactionItem } from '@/types'

const props = defineProps<{
  open: boolean
  tx: BankTransactionItem | null
}>()

const emit = defineEmits<{ close: [] }>()

const bank = useBankStore()
const { formatCurrency } = useFormatters()
const { maskValue } = usePrivacyMode()

const candidates = ref<BankTransactionItem[] | null>(null)
const failed = ref(false)
const saving = ref<string | null>(null)
const error = ref<string | null>(null)

watch(
  () => [props.open, props.tx?.id] as const,
  async ([open, id]) => {
    candidates.value = null
    failed.value = false
    error.value = null
    if (!open || !id) return
    try {
      const found = await bank.fetchTransferCounterparts(id)
      if (props.tx?.id === id) candidates.value = found
    } catch {
      if (props.tx?.id === id) failed.value = true
    }
  },
  { immediate: true },
)

function signed(tx: BankTransactionItem): string {
  const value = Number(tx.amount)
  return maskValue(formatCurrency(tx.is_credit ? value : -value, tx.currency))
}

function day(value: string | null): string {
  if (!value) return ''
  const [year, month, date] = value.split('-').map(Number)
  return new Date(year!, month! - 1, date!).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function sameAccount(candidate: BankTransactionItem): boolean {
  return candidate.account_id === props.tx?.account_id
}

async function bind(candidate: BankTransactionItem): Promise<void> {
  if (!props.tx) return
  saving.value = candidate.id
  error.value = null
  try {
    await bank.decideTransfer(props.tx.id, candidate.id, sameAccount(candidate) ? 'reversal' : 'transfer')
    emit('close')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Impossible de lier ces opérations.'
  } finally {
    saving.value = null
  }
}
</script>

<template>
  <BaseModal :open="open" title="Lier à une autre opération" size="lg" @close="emit('close')">
    <div v-if="tx" class="space-y-4">
      <p class="text-sm text-text-muted dark:text-text-dark-muted">
        {{ tx.label ?? 'Opération sans libellé' }} · {{ day(tx.operation_date) }} · {{ tx.account_name }} ·
        <span class="font-semibold tabular-nums text-text-main dark:text-text-dark-main">{{ signed(tx) }}</span>
      </p>

      <BaseAlert v-if="error" variant="danger">{{ error }}</BaseAlert>

      <p v-if="failed" class="text-sm text-text-muted dark:text-text-dark-muted">
        Impossible de charger les opérations candidates.
      </p>
      <div v-else-if="!candidates" class="space-y-2">
        <BaseSkeleton v-for="i in 3" :key="i" variant="rect" width="100%" height="2.75rem" />
      </div>
      <BaseEmptyState
        v-else-if="!candidates.length"
        title="Aucune opération à lier"
        description="Aucune opération du même montant, en sens inverse, à quelques semaines près."
      />
      <ul v-else class="divide-y divide-surface-border dark:divide-surface-dark-border -mx-2">
        <li v-for="candidate in candidates" :key="candidate.id" class="flex items-center gap-3 px-2 py-2.5">
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium text-text-main dark:text-text-dark-main" :title="candidate.label ?? undefined">
              {{ candidate.label ?? 'Opération sans libellé' }}
            </p>
            <p class="mt-0.5 text-xs text-text-muted dark:text-text-dark-muted">
              {{ day(candidate.operation_date) }} · {{ candidate.account_name }}
              <template v-if="candidate.transfer_account_name">
                · déjà lié {{ candidate.is_credit ? 'depuis' : 'vers' }} {{ candidate.transfer_account_name }}
              </template>
            </p>
          </div>
          <p class="shrink-0 text-sm font-semibold tabular-nums text-text-main dark:text-text-dark-main">
            {{ signed(candidate) }}
          </p>
          <BaseButton
            size="sm" variant="outline" class="shrink-0"
            :loading="saving === candidate.id" :disabled="saving !== null"
            @click="bind(candidate)"
          >
            <template v-if="sameAccount(candidate)">
              <Undo2 class="w-3.5 h-3.5 mr-1" /> Remboursement
            </template>
            <template v-else>
              <ArrowLeftRight class="w-3.5 h-3.5 mr-1" /> Virement
            </template>
          </BaseButton>
        </li>
      </ul>
    </div>
  </BaseModal>
</template>
