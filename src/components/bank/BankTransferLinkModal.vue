<script setup lang="ts">
/**
 * Binds an operation the pairing left alone: to its other leg on another
 * account, as a transfer, or to its cancellation on the same account — a
 * rejected transfer, a refunded card payment. The candidates are the API's:
 * same amount, opposite direction, a few weeks either side. Each says what
 * binding it does, and what pair it undoes; none fitting, the type is the way.
 */
import { computed, ref, watch } from 'vue'
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

const emit = defineEmits<{
  close: []
  /** None of them is its other side: what it is gets said by its type instead. */
  retype: [tx: BankTransactionItem]
}>()

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

/** Paired with another operation already: binding it here takes it from that pair. */
function pairedElsewhere(candidate: BankTransactionItem): boolean {
  return candidate.transfer_account_name !== null
    && candidate.transfer_status !== 'suggested'
    && candidate.transfer_id !== props.tx?.id
}

// The free ones first: the nearest day stays the order among each.
const sorted = computed(() =>
  candidates.value && [...candidates.value].sort((a, b) => Number(pairedElsewhere(a)) - Number(pairedElsewhere(b))),
)

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
      <div class="flex items-start gap-3 rounded-lg border border-surface-border dark:border-surface-dark-border px-3 py-2.5">
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium break-words text-text-main dark:text-text-dark-main">
            {{ tx.label ?? 'Opération sans libellé' }}
          </p>
          <p class="mt-0.5 text-xs text-text-muted dark:text-text-dark-muted">
            {{ day(tx.operation_date) }} · {{ tx.account_name }}
          </p>
        </div>
        <p class="shrink-0 text-sm font-semibold tabular-nums text-text-main dark:text-text-dark-main">{{ signed(tx) }}</p>
      </div>

      <BaseAlert v-if="error" variant="danger">{{ error }}</BaseAlert>

      <p v-if="failed" class="text-sm text-text-muted dark:text-text-dark-muted">
        Impossible de charger les opérations candidates.
      </p>
      <div v-else-if="!sorted" class="space-y-2">
        <BaseSkeleton v-for="i in 3" :key="i" variant="rect" width="100%" height="2.75rem" />
      </div>
      <BaseEmptyState
        v-else-if="!sorted.length"
        title="Aucune opération à lier"
        description="Aucune opération du même montant, en sens inverse, à quelques semaines près."
      />
      <div v-else>
        <p class="text-sm font-medium text-text-main dark:text-text-dark-main">Avec laquelle ?</p>
        <ul class="divide-y divide-surface-border dark:divide-surface-dark-border -mx-2">
          <li v-for="candidate in sorted" :key="candidate.id" class="flex items-start gap-3 px-2 py-3">
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium break-words text-text-main dark:text-text-dark-main">
                {{ candidate.label ?? 'Opération sans libellé' }}
              </p>
              <p class="mt-0.5 text-xs text-text-muted dark:text-text-dark-muted">
                {{ day(candidate.operation_date) }} · {{ candidate.account_name }}
              </p>
              <p class="mt-1 flex items-center gap-1 text-xs text-text-muted dark:text-text-dark-muted">
                <template v-if="sameAccount(candidate)">
                  <Undo2 class="w-3.5 h-3.5 shrink-0" /> Elles s'annulent, aucune n'est comptée.
                </template>
                <template v-else>
                  <ArrowLeftRight class="w-3.5 h-3.5 shrink-0" /> Virement entre vos comptes.
                </template>
              </p>
              <p v-if="pairedElsewhere(candidate)" class="mt-1 text-xs text-warning">
                Déjà liée {{ candidate.is_credit ? 'depuis' : 'vers' }} {{ candidate.transfer_account_name }} : la lier ici défait ce lien.
              </p>
            </div>
            <div class="flex shrink-0 flex-col items-end gap-1.5">
              <p class="text-sm font-semibold tabular-nums text-text-main dark:text-text-dark-main">{{ signed(candidate) }}</p>
              <BaseButton
                size="sm" variant="outline"
                :loading="saving === candidate.id" :disabled="saving !== null"
                @click="bind(candidate)"
              >
                Lier
              </BaseButton>
            </div>
          </li>
        </ul>
      </div>
    </div>

    <template v-if="tx" #footer>
      <p class="text-sm text-text-muted dark:text-text-dark-muted">
        Aucune ne correspond ?
        <button type="button" class="font-medium text-primary hover:underline" @click="emit('retype', tx)">
          Choisir son type
        </button>
      </p>
    </template>
  </BaseModal>
</template>
