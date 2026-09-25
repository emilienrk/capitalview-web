<script setup lang="ts">
/** One operation in the Opérations tab, grouped under its day or listed by amount. */
import { computed } from 'vue'
import { ArrowLeftRight, Check, HelpCircle, Link2, Repeat, TrendingUp, Undo2, Unlink, X } from 'lucide-vue-next'

import { BaseBadge, BaseButton } from '@/components'
import BankFlowGroup from '@/components/bank/BankFlowGroup.vue'
import { useFormatters } from '@/composables/useFormatters'
import { usePrivacyMode } from '@/composables/usePrivacyMode'
import {
  CASHFLOW_TYPE_LABELS,
  CASHFLOW_TYPE_TONES,
  OPERATION_TYPE_LABELS,
  PAIR_HINTS,
  answerHint,
  answerLabel,
  contributionBadge,
  typeSourceTitle,
} from '@/utils/cashflowTypes'
import { questionText, roleNote } from '@/utils/recurring'
import type { BankTransactionItem, BankTransferDecisionKind, CashflowType, RecurringDecisionKind } from '@/types'

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
  /** What the user's investment accounts say about it, already formatted. */
  contributionNote?: string
}>()

/** What the answer moves, said when the label weighs more than this operation. Formatted, privacy included. */
const stake = computed(() => props.stakeAmount ?? null)

defineEmits<{
  decide: [kind: BankTransferDecisionKind]
  link: []
  answer: [type: CashflowType]
  retype: []
  subscribe: [decision: RecurringDecisionKind]
  recurring: []
}>()

const { formatCurrency } = useFormatters()
const { maskValue } = usePrivacyMode()

function money(value: number): string {
  return maskValue(formatCurrency(Number(value), props.tx.currency))
}

const suggested = computed(() => props.tx.transfer_status === 'suggested')
/** The other side of a pair offered to the user: what the pair is judged by. */
const offered = computed(() => {
  const { transfer_label: label, transfer_date: day } = props.tx
  if (!suggested.value || !label) return null
  const when = day
    ? new Date(`${day}T00:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
    : null
  return `En face, sur ${props.tx.transfer_account_name}${when ? ` le ${when}` : ''} : ${label}`
})
const cancelled = computed(() =>
  props.tx.transfer_status === 'reversal' || props.tx.transfer_status === 'refund',
)
/** A settled pair counts by its pair, undone through the transfer decision: no type to pick. */
const typable = computed(() => props.tx.transfer_status === null || suggested.value)
/** A transfer asked about: nothing pairs it, so where it went is unknown. */
const unpairedTransfer = computed(
  () => props.tx.flow_question !== null && props.tx.operation_type === 'TRANSFER' && !props.tx.transfer_account_name,
)
/**
 * What the API lets the user file under a recurring by hand: a past debit
 * counted as spent or a credit counted as received, no transfer between the
 * accounts — or one already filed, to take it out.
 */
const recurrable = computed(() => {
  const tx = props.tx
  if (tx.recurring) return true
  return !tx.is_pending && tx.transfer_status === null && tx.cashflow_type === (tx.is_credit ? 'INCOME' : 'EXPENSE')
})
const recurringAction = computed(() =>
  props.tx.recurring
    ? `Retirer de ${props.tx.recurring.name}`
    : `Rattacher à un ${props.tx.is_credit ? 'revenu' : 'paiement'} récurrent`,
)
const incomeQuestion = computed(() => props.tx.recurring_question?.direction === 'income')
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
          :title="typeSourceTitle(tx.type_source)"
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
        <!-- A deposit or withdrawal the investment account proves: read like a
             transfer to one of the user's accounts. -->
        <BaseBadge v-else-if="tx.contribution?.exact" variant="info">
          <TrendingUp class="inline w-3 h-3 mr-1 -mt-px" />
          {{ contributionBadge(tx.contribution) }}
        </BaseBadge>
        <!-- Why this one is asked at all: the bank names no account, and none
             of the user's own holds the other leg. -->
        <BaseBadge v-else-if="unpairedTransfer" variant="secondary">
          <ArrowLeftRight class="inline w-3 h-3 mr-1 -mt-px" />
          {{ tx.is_credit ? 'depuis' : 'vers' }} ?
        </BaseBadge>
        <!-- A refund happened once: it names what it comes off, not a rhythm. -->
        <BaseBadge v-if="tx.recurring?.role === 'refund'" variant="secondary" :title="tx.recurring.name">
          <Undo2 class="inline w-3 h-3 mr-1 -mt-px" />
          {{ tx.recurring.direction === 'income' ? 'Reprise' : 'Remboursement' }} · {{ tx.recurring.name }}
        </BaseBadge>
        <BaseBadge v-else-if="tx.recurring" variant="primary" :title="tx.recurring.name">
          <Repeat class="inline w-3 h-3 mr-1 -mt-px" />
          Récurrent<template v-if="roleNote(tx.recurring.role, tx.recurring.direction)"> · {{ roleNote(tx.recurring.role, tx.recurring.direction) }}</template>
        </BaseBadge>
        <BaseBadge v-if="tx.is_pending" variant="warning">En attente</BaseBadge>
      </div>
      <!-- What the investment accounts say: the deposit this operation was
           recognised as, or a nearby one to answer the question by. -->
      <p
        v-if="contributionNote"
        :class="[
          'mt-1 flex items-center gap-1 text-xs',
          tx.contribution?.exact ? 'text-info' : 'text-text-muted dark:text-text-dark-muted',
        ]"
      >
        <TrendingUp class="w-3.5 h-3.5 shrink-0" />
        {{ contributionNote }}
      </p>
      <p v-if="offered" class="mt-1 flex items-center gap-1 text-xs text-text-muted dark:text-text-dark-muted">
        <ArrowLeftRight class="w-3.5 h-3.5 shrink-0" />
        <span class="truncate" :title="offered">{{ offered }}</span>
      </p>
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
          class="px-3 py-1.5 sm:px-2 sm:py-0.5 rounded-button bg-warning/10 text-warning font-medium hover:bg-warning/20 disabled:opacity-50"
          @click="$emit('answer', choice)"
        >
          {{ answerLabel(choice, tx.is_credit) }}
        </button>
        <!-- What the answer covers, openable: the operations it would type. -->
        <BankFlowGroup
          v-if="tx.flow_question.operation_count > 1"
          :transaction-id="tx.id"
          :count="tx.flow_question.operation_count"
          :stake="stake ?? undefined"
          :label="tx.label"
        />
        <!-- The hints sit on operations the question is not asked on: said
             here, and shown on each of them once the list is open. -->
        <span v-if="tx.flow_question.hints" class="basis-full inline-flex items-center gap-1 text-text-muted dark:text-text-dark-muted">
          <TrendingUp class="w-3.5 h-3.5 shrink-0" />
          {{ tx.flow_question.hints === 1
            ? "Une de ces opérations pourrait être un versement sur un compte d'investissement."
            : `${tx.flow_question.hints} de ces opérations pourraient être des versements sur un compte d'investissement.` }}
        </span>
      </div>
      <!-- A recurring charge or income found but not sure enough to count:
           asked on its last operation, in the same style. The answer moves no
           total, only the part of the expenses or income said to be recurring. -->
      <div v-if="tx.recurring_question" class="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
        <span class="inline-flex items-center gap-1 text-warning font-medium">
          <Repeat class="w-3.5 h-3.5" />
          {{ questionText(tx.recurring_question, money(tx.recurring_question.amount)) }}
        </span>
        <button
          type="button"
          :disabled="busy"
          :title="`Compté dans les ${incomeQuestion ? 'revenus' : 'paiements'} récurrents, et ses prochaines échéances avec lui.`"
          class="px-3 py-1.5 sm:px-2 sm:py-0.5 rounded-button bg-warning/10 text-warning font-medium hover:bg-warning/20 disabled:opacity-50"
          @click="$emit('subscribe', 'confirm')"
        >
          Oui
        </button>
        <button
          type="button"
          :disabled="busy"
          :title="incomeQuestion
            ? 'Pas un revenu récurrent : il ne sera plus proposé.'
            : 'Ce n\'est pas récurrent : il ne sera plus proposé.'"
          class="px-3 py-1.5 sm:px-2 sm:py-0.5 rounded-button bg-warning/10 text-warning font-medium hover:bg-warning/20 disabled:opacity-50"
          @click="$emit('subscribe', 'refuse')"
        >
          Non
        </button>
        <span class="basis-full text-text-muted dark:text-text-dark-muted">
          {{ tx.recurring_question.occurrence_count }} échéances, ≈ {{ money(tx.recurring_question.annual_estimate) }} par an<template
            v-if="tx.recurring_question.renamed_from.length"> · a changé de nom, anciennement {{ tx.recurring_question.renamed_from.join(', ') }}</template>
        </span>
      </div>
    </div>
    <p :class="['shrink-0 text-sm font-semibold tabular-nums', amountClass]">
      {{ amount }}
    </p>
    <!-- A fixed width, so the amounts line up whether a row offers one action or two. -->
    <div class="shrink-0 w-16 flex items-center justify-end gap-0.5">
      <BaseButton
        v-if="!suggested && recurrable"
        class="sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100"
        icon size="sm" variant="ghost" :disabled="busy"
        :aria-label="recurringAction" :title="recurringAction"
        @click="$emit('recurring')"
      >
        <Repeat class="w-4 h-4" />
      </BaseButton>
      <!-- Only a suggested pair asks: every other one was settled without the user.
           The corrections stay out of sight until hovered, so the list does not
           read as a to-do list. -->
      <template v-if="suggested">
        <BaseButton
          icon size="sm" variant="ghost" :disabled="busy"
          aria-label="C'est un virement entre mes comptes" :title="PAIR_HINTS.transfer"
          @click="$emit('decide', 'transfer')"
        >
          <Check class="w-4 h-4" />
        </BaseButton>
        <BaseButton
          icon size="sm" variant="ghost" :disabled="busy"
          aria-label="Ce n'est pas un virement" :title="PAIR_HINTS.notTransfer"
          @click="$emit('decide', 'not_transfer')"
        >
          <X class="w-4 h-4" />
        </BaseButton>
      </template>
      <BaseButton
        v-else-if="tx.transfer_id"
        class="sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100"
        icon size="sm" variant="ghost" :disabled="busy"
        aria-label="Dissocier" :title="PAIR_HINTS.unlink"
        @click="$emit('decide', 'not_transfer')"
      >
        <Unlink class="w-4 h-4" />
      </BaseButton>
      <BaseButton
        v-else
        class="sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100"
        icon size="sm" variant="ghost" :disabled="busy"
        aria-label="Lier à une autre opération" :title="PAIR_HINTS.link"
        @click="$emit('link')"
      >
        <Link2 class="w-4 h-4" />
      </BaseButton>
    </div>
  </li>
</template>
