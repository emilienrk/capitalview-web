<script setup lang="ts">
/** One operation in the Opérations tab, grouped under its day or listed by amount. */
import { computed } from 'vue'
import { ArrowLeftRight, Check, HelpCircle, Link2, Undo2, Unlink, X } from 'lucide-vue-next'

import { BaseBadge, BaseButton } from '@/components'
import { CASHFLOW_TYPE_LABELS, CASHFLOW_TYPE_TONES, OPERATION_TYPE_LABELS, answerHint, answerLabel } from '@/utils/cashflowTypes'
import type { BankTransactionItem, BankTransferDecisionKind, CashflowType } from '@/types'

const props = defineProps<{
  tx: BankTransactionItem
  /** Shown only when the list is not already grouped by day. */
  date?: string
  showAccount: boolean
  amount: string
  amountClass: string
  /** A decision about this operation is on its way. */
  busy?: boolean
  /** The formatted total of the label a flow question settles. */
  stakeAmount?: string
}>()

/** What the answer moves, said when the label weighs more than this operation. Formatted, privacy included. */
const stake = computed(() => props.stakeAmount ?? null)

defineEmits<{
  decide: [kind: BankTransferDecisionKind]
  link: []
  answer: [type: CashflowType]
  retype: []
}>()

const suggested = computed(() => props.tx.transfer_status === 'suggested')
const cancelled = computed(() =>
  props.tx.transfer_status === 'reversal' || props.tx.transfer_status === 'refund',
)
/** A settled pair counts by its pair, undone through the transfer decision: no type to pick. */
const typable = computed(() => props.tx.transfer_status === null || suggested.value)
const paymentMeans = computed(() =>
  props.tx.operation_type === 'UNKNOWN' ? null : OPERATION_TYPE_LABELS[props.tx.operation_type],
)
</script>

<template>
  <li :class="['group flex items-center gap-3 px-4 sm:px-6 py-3', tx.is_pending ? 'opacity-70' : '']">
    <div class="min-w-0 flex-1">
      <p class="truncate text-sm font-medium text-text-main dark:text-text-dark-main" :title="tx.label ?? undefined">
        {{ tx.label ?? 'Opération sans libellé' }}
      </p>
      <div class="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-text-muted dark:text-text-dark-muted">
        <span v-if="date">{{ date }}</span>
        <span v-if="date && showAccount" aria-hidden="true">·</span>
        <span v-if="showAccount">{{ tx.account_name }}</span>
        <span v-if="paymentMeans" class="text-text-muted/80 dark:text-text-dark-muted/80">{{ paymentMeans }}</span>
        <button
          v-if="typable"
          type="button"
          :class="['px-2 py-0.5 rounded-full font-medium transition-opacity hover:opacity-80', CASHFLOW_TYPE_TONES[tx.cashflow_type]]"
          :title="tx.type_source === 'default' ? 'Type détecté : le changer' : 'Type choisi : le changer'"
          @click="$emit('retype')"
        >
          {{ CASHFLOW_TYPE_LABELS[tx.cashflow_type] }}
        </button>
        <BaseBadge v-if="cancelled" variant="secondary">
          <Undo2 class="inline w-3 h-3 mr-1 -mt-px" />
          {{ tx.transfer_status === 'refund' ? (tx.is_credit ? 'Remboursement' : 'Remboursée') : 'Annulée' }}
        </BaseBadge>
        <BaseBadge v-else-if="tx.transfer_account_name" :variant="suggested ? 'warning' : 'info'">
          <ArrowLeftRight class="inline w-3 h-3 mr-1 -mt-px" />
          {{ tx.is_credit ? 'depuis' : 'vers' }} {{ tx.transfer_account_name }}{{ suggested ? ' ?' : '' }}
          <Check v-if="tx.transfer_status === 'confirmed'" class="inline w-3 h-3 ml-1 -mt-px" aria-label="confirmé" />
        </BaseBadge>
        <BaseBadge v-if="tx.is_pending" variant="warning">En attente</BaseBadge>
      </div>
      <!-- Asked on the last operation of a label only the user can type, beside
           the transfer questions and in their style. -->
      <div v-if="tx.flow_question" class="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
        <span class="inline-flex items-center gap-1 text-warning font-medium">
          <HelpCircle class="w-3.5 h-3.5" />
          {{ tx.is_credit ? 'Cette entrée, c\'est…' : 'Ce virement émis, c\'est…' }}
        </span>
        <button
          v-for="choice in tx.flow_question.choices"
          :key="choice"
          type="button"
          :disabled="busy"
          :title="answerHint(choice, tx.is_credit)"
          class="px-2 py-0.5 rounded-button bg-warning/10 text-warning font-medium hover:bg-warning/20 disabled:opacity-50"
          @click="$emit('answer', choice)"
        >
          {{ answerLabel(choice, tx.is_credit) }}
        </button>
        <span v-if="tx.flow_question.operation_count > 1" class="text-text-muted dark:text-text-dark-muted">
          s'applique aux {{ tx.flow_question.operation_count }} opérations de ce libellé<template v-if="stake">, {{ stake }} en tout</template>
        </span>
      </div>
    </div>
    <p :class="['shrink-0 text-sm font-semibold tabular-nums', amountClass]">
      {{ amount }}
    </p>
    <!-- A fixed width, so the amounts line up whether a row offers one action or two. -->
    <div class="shrink-0 w-16 flex items-center justify-end gap-0.5">
      <!-- Only a suggested pair asks: every other one was settled without the user.
           The corrections stay out of sight until hovered, so the list does not
           read as a to-do list. -->
      <template v-if="suggested">
        <BaseButton
          icon size="sm" variant="ghost" :disabled="busy"
          aria-label="C'est un virement entre mes comptes" title="C'est un virement entre mes comptes"
          @click="$emit('decide', 'transfer')"
        >
          <Check class="w-4 h-4" />
        </BaseButton>
        <BaseButton
          icon size="sm" variant="ghost" :disabled="busy"
          aria-label="Ce n'est pas un virement" title="Ce n'est pas un virement"
          @click="$emit('decide', 'not_transfer')"
        >
          <X class="w-4 h-4" />
        </BaseButton>
      </template>
      <BaseButton
        v-else-if="tx.transfer_id"
        class="sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100"
        icon size="sm" variant="ghost" :disabled="busy"
        aria-label="Dissocier" title="Dissocier : compter les deux opérations"
        @click="$emit('decide', 'not_transfer')"
      >
        <Unlink class="w-4 h-4" />
      </BaseButton>
      <BaseButton
        v-else
        class="sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100"
        icon size="sm" variant="ghost" :disabled="busy"
        aria-label="Lier à une autre opération" title="Lier à un virement ou à son remboursement"
        @click="$emit('link')"
      >
        <Link2 class="w-4 h-4" />
      </BaseButton>
    </div>
  </li>
</template>
