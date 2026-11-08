<script setup lang="ts">
/** One operation in the Opérations tab, grouped under its day or listed by amount. */
import { computed, ref, watch } from 'vue'
import { ArrowLeftRight, Check, Link2, Pencil, Repeat, Trash2, TrendingUp, Undo2, Unlink } from 'lucide-vue-next'

import { BaseBadge, BaseButton } from '@/components'
import BankAnswerButton from '@/components/bank/BankAnswerButton.vue'
import BankFlowGroup from '@/components/bank/BankFlowGroup.vue'
import { useFormatters } from '@/composables/useFormatters'
import { usePrivacyMode } from '@/composables/usePrivacyMode'
import { useBankStore } from '@/stores/bank'
import {
  CASHFLOW_TYPE_TONES,
  PAIR_HINTS,
  answerHint,
  answerLabel,
  contributionBadge,
  pairChoices,
  togetherNote,
  typeSourceTitle,
} from '@/utils/cashflowTypes'
import { INVESTMENT_ACCOUNT_ICON, bankAccountIcon } from '@/utils/bankAccountIcon'
import { questionText, roleNote } from '@/utils/recurring'
import type {
  BankContributionAnswer, BankContributionDecisionKind, BankTransactionItem, BankTransferDecisionKind, CashflowType, RecurringDecisionKind,
  TypeScope,
} from '@/types'

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
  /** What differs from the deposit or withdrawal facing it, already formatted. */
  contributionNote?: string
}>()

/** What the answer moves, said when the label weighs more than this operation. Formatted, privacy included. */
const stake = computed(() => props.stakeAmount ?? null)

defineEmits<{
  decide: [kind: BankTransferDecisionKind]
  /** The offered pair is made with this other operation instead. */
  pick: [otherId: string]
  /** A suggested pair is set aside for the deposit facing the operation. */
  deposit: []
  /** None of the movements offered: each pair refused, the deposit answered no. */
  refuse: []
  /** The operation is, or is not, the deposit or withdrawal facing it — or
   * the operations ticked in its group are, each with its own. */
  contribution: [kind: BankContributionDecisionKind, answers: BankContributionAnswer[], members: BankTransactionItem[]]
  link: []
  /** `picked`: the operations to type with the operation scope, this one or those ticked in its label;
   * `members`: the label's operations, once its list was opened. */
  answer: [type: CashflowType, scope: TypeScope, picked: string[], members: BankTransactionItem[]]
  retype: []
  subscribe: [decision: RecurringDecisionKind]
  recurring: []
  remove: []
  edit: []
}>()

const { formatCurrency } = useFormatters()

/** An answer types this operation alone unless the user asks for the whole
 * label, the next ones included: one label often means several things
 * (docs/bank-sorting.md). */
const wholeLabel = ref(false)
/** The label's list open to tick from, and what is ticked: this one to begin with. */
const picking = ref(false)
const picked = ref<string[]>([props.tx.id])
const answering = computed<string[]>(() => (picking.value ? picked.value : [props.tx.id]))
const { maskValue } = usePrivacyMode()

function money(value: number): string {
  return maskValue(formatCurrency(Number(value), props.tx.currency))
}

const suggested = computed(() => props.tx.transfer_status === 'suggested')
/** Asked yes or no, in place of the type question: only the user knows it went there. */
const asksDeposit = computed(() => props.tx.asks_contribution)
/** The operations of the group, and the deposit or withdrawal facing each, once its list is open. */
const members = ref<BankTransactionItem[]>([])
const facing = ref<Record<string, string>>({})
function onGroupLoaded(operations: BankTransactionItem[]): void {
  members.value = operations
  facing.value = Object.fromEntries(
    operations.flatMap((operation) => (operation.contribution ? [[operation.id, operation.contribution.id]] : [])),
  )
}
/** What a yes or a no covers: this operation, or those ticked, each with what faces it. */
const depositAnswers = computed<BankContributionAnswer[]>(() =>
  answering.value.flatMap((id) => {
    const contributionId = id === props.tx.id ? props.tx.contribution?.id : facing.value[id]
    return contributionId ? [{ transaction_id: id, contribution_id: contributionId }] : []
  }),
)
/** Answered one at a time, a label's question moves on to its next operation in
 * the same row (À trier): what was ticked went with the answer, and the new
 * operation shows itself coming in. */
const swaps = ref(0)
// A string, compared by value: every reload hands the row a new `tx`.
watch(() => `${props.tx.id}:${props.tx.flow_question?.operation_count ?? ''}`, () => {
  wholeLabel.value = false
  picking.value = false
  picked.value = [props.tx.id]
  members.value = []
  facing.value = {}
  swaps.value += 1
})
const proved = computed(() => props.tx.type_source === 'contribution')
/** A yes counts it as an investment, out of the recurring payment it is one of. */
const leavesRecurring = computed(() =>
  props.tx.type_source === 'recurring' && props.tx.recurring ? props.tx.recurring.name : null,
)
function onDay(day: string | null | undefined): string {
  return day
    ? ` le ${new Date(`${day}T00:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`
    : ''
}
const bank = useBankStore()
/** What a pair offered may be made with, one line each; several, each line
 * carries its own button, so no answer leaves the user guessing which. */
const choosing = computed(() => choices.value.length > 1)
const choices = computed(() =>
  pairChoices(props.tx).map((choice) => {
    const contribution = props.tx.contribution
    const what = choice.kind === 'deposit' && contribution
      ? `${contribution.is_deposit ? 'versement' : 'retrait'} de ${money(contribution.amount)}`
      : choice.label ?? 'Opération sans libellé'
    const hint = choice.kind === 'deposit'
      ? 'Comptée en investissement.'
      : choice.kind === 'pair' ? togetherNote(props.tx.together_type) : 'Liées l\'une à l\'autre : un virement entre vos comptes, ou un remboursement.'
    const day = onDay(choice.day).replace(/^ le /, '')
    return { ...choice, what, day, icon: choice.kind === 'deposit'
      ? INVESTMENT_ACCOUNT_ICON
      : bankAccountIcon(bank.summary?.accounts ?? [], { id: choice.accountId, name: choice.account }), text: [choice.account, day, what].filter(Boolean).join(' · '), hint }
  }),
)
const cancelled = computed(() =>
  props.tx.transfer_status === 'reversal' || props.tx.transfer_status === 'refund',
)
/** An adjustment only moves the balance: no type, no pair, no recurring. */
const adjustment = computed(() => props.tx.origin === 'adjustment')
const ORIGIN_BADGES = { manual: 'Saisie', adjustment: 'Ajustement' } as const
const ORIGIN_TITLES = {
  manual: 'Saisie à la main : un relevé qui la contient la remplace.',
  adjustment: 'Solde repris quand le compte a cessé d\'être synchronisé. Ne compte ni en dépense ni en revenu.',
} as const
/** A settled pair counts by its pair, undone through the transfer decision: no type to pick. */
const typable = computed(() => !adjustment.value && (props.tx.transfer_status === null || suggested.value))
/**
 * What the API lets the user file under a recurring by hand: a past debit
 * counted as spent or a credit counted as received, no transfer between the
 * accounts — or one already filed, to take it out.
 */
const recurrable = computed(() => {
  const tx = props.tx
  if (tx.recurring) return true
  if (adjustment.value) return false
  return !tx.is_pending && tx.transfer_status === null && tx.cashflow_type === (tx.is_credit ? 'INCOME' : 'EXPENSE')
})
const recurringAction = computed(() =>
  props.tx.recurring
    ? `Retirer de ${props.tx.recurring.name}`
    : `Rattacher à un ${props.tx.is_credit ? 'revenu' : 'paiement'} récurrent`,
)
const incomeQuestion = computed(() => props.tx.recurring_question?.direction === 'income')
</script>

<template>
  <!-- On a phone the label shares its line with the amount alone: the actions
       drop beside the details below it, and the questions take the full width. -->
  <li
    :class="[
      'group grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_auto_auto] gap-x-3 px-4 sm:px-6 py-3',
      tx.is_pending ? 'opacity-70' : '',
    ]"
  >
    <p :key="tx.id" :class="{ 'cv-swap': swaps }" class="col-start-1 row-start-1 line-clamp-2 sm:line-clamp-1 break-words text-sm font-medium text-text-main dark:text-text-dark-main" :title="tx.label ?? undefined">
      {{ tx.label ?? 'Opération sans libellé' }}
    </p>
    <div :key="tx.id" :class="{ 'cv-swap': swaps }" class="col-start-1 row-start-2 mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-text-muted dark:text-text-dark-muted">
      <span v-if="date">{{ date }}</span>
      <span v-if="date && showAccount" aria-hidden="true">·</span>
      <span v-if="showAccount">{{ tx.account_name }}</span>
      <button
        v-if="typable"
        type="button"
        :class="['px-2 py-0.5 rounded-full font-medium transition-opacity hover:opacity-80', CASHFLOW_TYPE_TONES[tx.cashflow_type]]"
        :title="typeSourceTitle(tx.type_source)"
        @click="$emit('retype')"
      >
        {{ answerLabel(tx.cashflow_type, tx.is_credit) }}
      </button>
      <BaseBadge v-if="cancelled" variant="secondary">
        <Undo2 class="inline w-3 h-3 mr-1 -mt-px" />
        {{ tx.transfer_status === 'refund' ? (tx.is_credit ? 'Remboursement' : 'Remboursée') : 'Annulée' }}
      </BaseBadge>
      <!-- Offered, the lines below name the other side and its account. -->
      <template v-else-if="tx.transfer_account_name && suggested" />
      <BaseBadge v-else-if="tx.transfer_account_name" variant="info">
        <ArrowLeftRight class="inline w-3 h-3 mr-1 -mt-px" />
        {{ tx.is_credit ? 'depuis' : 'vers' }} {{ tx.transfer_account_name }}
        <Check v-if="tx.transfer_status === 'confirmed'" class="inline w-3 h-3 ml-1 -mt-px" aria-label="confirmé" />
      </BaseBadge>
      <!-- A deposit or withdrawal facing it: read like a transfer to one of the
           user's accounts, offered until the user vouches for it. -->
      <BaseBadge v-else-if="tx.contribution && (proved || asksDeposit)" :variant="proved ? 'info' : 'warning'">
        <TrendingUp class="inline shrink-0 w-3 h-3 mr-1 -mt-px" />
        {{ contributionBadge(tx.contribution) }}{{ proved ? '' : ' ?' }}
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
      <BaseBadge v-if="tx.origin" variant="secondary" :title="ORIGIN_TITLES[tx.origin]">
        {{ ORIGIN_BADGES[tx.origin] }}
      </BaseBadge>
    </div>
    <div class="min-w-0 col-span-full sm:col-end-2 row-start-3">
      <!-- The badge names the account and asks; this says only what differs
           from the operation: another amount (a fee, once vouched for), another day. -->
      <p v-if="contributionNote && (proved || asksDeposit)" class="mt-1 text-xs text-text-muted dark:text-text-dark-muted">
        {{ contributionNote }}
      </p>
      <!-- The operations of a label facing a deposit of one investment account
           ask together, each with its own deposit. A yes vouches for the
           label, so the next ones prove themselves; a no puts the operation
           back with the others. Open, the answer goes to those ticked. -->
      <div v-if="asksDeposit" class="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
        <BankAnswerButton
          :disabled="busy || !depositAnswers.length"
          title="Comptée en investissement, avec les autres opérations de ce libellé qui ont leur propre versement ou retrait en face, le même jour."
          @click="$emit('contribution', 'contribution', depositAnswers, members)"
        >
          Oui
        </BankAnswerButton>
        <BankAnswerButton
          :disabled="busy || !depositAnswers.length"
          title="Ce n'est pas ce mouvement : l'opération compte comme les autres."
          muted
          @click="$emit('contribution', 'not_contribution', depositAnswers, members)"
        >
          Non
        </BankAnswerButton>
        <span v-if="leavesRecurring" class="text-text-muted dark:text-text-dark-muted">
          Oui : sortira du récurrent {{ leavesRecurring }}
        </span>
        <BankFlowGroup
          v-if="tx.flow_question && tx.flow_question.operation_count > 1"
          :key="`${tx.id}-${tx.flow_question.operation_count}`"
          v-model:open="picking"
          v-model:picked="picked"
          :transaction-id="tx.id"
          :count="tx.flow_question.operation_count"
          :stake="stake ?? undefined"
          :label="tx.label"
          :account="tx.account_name"
          :note-above="!!contributionNote"
          picking
          @loaded="onGroupLoaded"
        />
      </div>
      <!-- A pair offered, it may be a transfer or a refund: no arrow claims
           which. Several movements, the deposit facing it among them: each line
           carries its own button, "Aucune" refuses them all. -->
      <ul v-if="choices.length" class="mt-1 space-y-1 text-xs text-text-muted dark:text-text-dark-muted">
        <li v-for="choice in choices" :key="`${choice.kind}-${choice.id}`" class="flex items-center gap-2">
          <span class="min-w-0 line-clamp-2 break-words" :title="choice.text">
            <component :is="choice.icon" class="inline w-3 h-3 mr-1 -mt-px" aria-hidden="true" />
            <span class="font-medium text-text-main dark:text-text-dark-main">{{ choice.account }}</span>
            <template v-if="choice.day"> · {{ choice.day }}</template> · {{ choice.what }}
          </span>
          <BankAnswerButton
            v-if="choosing"
            :disabled="busy"
            class="shrink-0"
            :title="choice.hint"
            @click="choice.kind === 'pair' ? $emit('decide', 'transfer') : choice.kind === 'other' ? $emit('pick', choice.id) : $emit('deposit')"
          >
            {{ choice.kind === 'deposit' ? 'Celui-ci' : 'Celle-ci' }}
          </BankAnswerButton>
        </li>
        <li v-if="choosing">
          <BankAnswerButton :disabled="busy" :title="PAIR_HINTS.none" muted @click="$emit('refuse')">
            Aucune
          </BankAnswerButton>
        </li>
      </ul>
      <!-- A single pair offered: the line under the buttons says what "Ensemble" counts. -->
      <div v-if="suggested && !choosing" class="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
        <BankAnswerButton
          :disabled="busy"
          :title="PAIR_HINTS.transfer"
          @click="$emit('decide', 'transfer')"
        >
          Ensemble
        </BankAnswerButton>
        <BankAnswerButton
          :disabled="busy"
          :title="PAIR_HINTS.notTransfer"
          muted
          @click="$emit('decide', 'not_transfer')"
        >
          Pas ensemble
        </BankAnswerButton>
        <span class="basis-full text-text-muted dark:text-text-dark-muted">
          {{ togetherNote(tx.together_type) }}
        </span>
      </div>
      <!-- Asked on the last operation of a label only the user can type, beside
           the transfer questions and in their style. -->
      <div v-if="tx.flow_question && !asksDeposit" class="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
        <BankAnswerButton
          v-for="choice in tx.flow_question.choices"
          :key="choice"
          :disabled="busy || (!wholeLabel && !answering.length)"
          :title="answerHint(choice, tx.is_credit)"
          @click="$emit('answer', choice, wholeLabel ? 'label' : 'operation', wholeLabel ? [tx.id] : answering, members)"
        >
          {{ answerLabel(choice, tx.is_credit) }}
        </BankAnswerButton>
        <label
          class="inline-flex items-center gap-1 text-text-muted dark:text-text-dark-muted cursor-pointer"
          title="Crée une règle sur ce libellé, qui classe aussi les prochaines opérations. Elle se retrouve et se supprime dans l'onglet Règles."
        >
          <input v-model="wholeLabel" type="checkbox" class="w-3.5 h-3.5 rounded accent-primary" :disabled="busy" />
          Toutes celles de ce libellé, et les prochaines
        </label>
        <!-- What the answer covers, openable: the operations it would type,
             to tick from unless the whole label is answered. -->
        <BankFlowGroup
          v-if="tx.flow_question.operation_count > 1"
          :key="`${tx.id}-${tx.flow_question.operation_count}`"
          v-model:open="picking"
          v-model:picked="picked"
          :transaction-id="tx.id"
          :count="tx.flow_question.operation_count"
          :stake="stake ?? undefined"
          :label="tx.label"
          :account="tx.account_name"
          :picking="!wholeLabel"
          @loaded="onGroupLoaded"
        />
      </div>
      <!-- A recurring charge or income found but not sure enough to count:
           asked on its last operation, in the same style. The answer moves no
           total, only the part of the expenses or income said to be recurring. -->
      <div v-if="tx.recurring_question" class="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
        <span class="inline-flex items-center gap-1 text-warning font-medium">
          <Repeat class="w-3.5 h-3.5" />
          {{ questionText(tx.recurring_question, money(tx.recurring_question.amount)) }}
        </span>
        <BankAnswerButton
          :disabled="busy"
          :title="`Compté dans les ${incomeQuestion ? 'revenus' : 'paiements'} récurrents, et ses prochaines échéances avec lui.`"
          @click="$emit('subscribe', 'confirm')"
        >
          Oui
        </BankAnswerButton>
        <BankAnswerButton
          :disabled="busy"
          :title="incomeQuestion
            ? 'Pas un revenu récurrent : il ne sera plus proposé.'
            : 'Ce n\'est pas récurrent : il ne sera plus proposé.'"
          muted
          @click="$emit('subscribe', 'refuse')"
        >
          Non
        </BankAnswerButton>
        <!-- A series that changed its name would not be recognised by the one it bears now. -->
        <span v-if="tx.recurring_question.renamed_from.length" class="basis-full text-text-muted dark:text-text-dark-muted">
          Anciennement {{ tx.recurring_question.renamed_from.join(', ') }}
        </span>
      </div>
    </div>
    <p :key="tx.id" :class="['col-start-2 row-start-1 sm:row-end-3 self-start sm:self-center text-right text-sm font-semibold tabular-nums whitespace-nowrap', amountClass, { 'cv-swap': swaps }]">
      {{ amount }}
    </p>
    <!-- A fixed width, so the amounts line up however many actions a row offers. -->
    <div class="col-start-2 row-start-2 sm:col-start-3 sm:row-start-1 sm:row-end-3 self-center w-24 flex items-center justify-end gap-0.5">
      <BaseButton
        v-if="!suggested && recurrable"
        class="sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100"
        icon size="sm" variant="ghost" :disabled="busy"
        :aria-label="recurringAction" :title="recurringAction"
        @click="$emit('recurring')"
      >
        <Repeat class="w-4 h-4" />
      </BaseButton>
      <!-- A suggested pair asks in the question below; every other one was
           settled without the user. The corrections stay out of sight until
           hovered, so the list does not read as a to-do list. -->
      <template v-if="suggested" />
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
        v-else-if="!tx.origin"
        class="sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100"
        icon size="sm" variant="ghost" :disabled="busy"
        aria-label="Lier à une autre opération" :title="PAIR_HINTS.link"
        @click="$emit('link')"
      >
        <Link2 class="w-4 h-4" />
      </BaseButton>
      <!-- Typed by hand: corrected or deleted in the modal it was typed in. -->
      <BaseButton
        v-if="tx.origin === 'manual'"
        class="sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100"
        icon size="sm" variant="ghost" :disabled="busy"
        aria-label="Modifier l'opération" title="Modifier l'opération"
        @click="$emit('edit')"
      >
        <Pencil class="w-4 h-4" />
      </BaseButton>
      <!-- What a balance put there can be taken back; what a bank reported
           only before its own history. -->
      <BaseButton
        v-else-if="tx.deletable"
        class="sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100"
        icon size="sm" variant="ghost" :disabled="busy"
        aria-label="Supprimer l'opération" title="Supprimer l'opération"
        @click="$emit('remove')"
      >
        <Trash2 class="w-4 h-4" />
      </BaseButton>
    </div>
  </li>
</template>
