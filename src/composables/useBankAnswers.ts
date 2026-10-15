/**
 * The answers given on an operation's row, the same in À trier and Opérations:
 * a type, yes or no to the deposit facing it, a pair, a recurring series.
 *
 * Each answer moves the list at the click (`bank.answering`), then the reload
 * it triggers brings the server's own; a failure puts the list back and says
 * why, at the foot of the screen (`useToast`). Only picking another pair waits
 * for the API: which pairs it undoes is the server's to say.
 */
import { ref } from 'vue'

import { toastWhileSet, useToast, type ToastPart } from '@/composables/useToast'

import { useBankStore } from '@/stores/bank'
import { useCashflowTypesStore } from '@/stores/cashflowTypes'
import { useRecurringStore } from '@/stores/recurring'
import { CASHFLOW_TYPE_LABELS, RULES_PAGE, contributionMessage, keptByHand, ownAnswer } from '@/utils/cashflowTypes'
import {
  contributionAnswerEffect, recurringAnswerEffect, transferAnswerEffect, typeAnswerEffect,
} from '@/utils/optimisticAnswers'
import type {
  BankContributionDecisionKind, BankHistoryKind, BankTransactionItem, BankTransactionTypeResult,
  BankTransferDecisionKind, CashflowType, RecurringDecisionKind, TypeScope,
} from '@/types'

/** What "Annuler" takes back: a type or a deposit answer. */
interface Answered {
  /** The rule the answer wrote, which undoing deletes. */
  ruleId: string | null
  transactionIds: string[]
  /** A yes or no to the deposit facing it: that decision is what undoing withdraws. */
  contribution?: boolean
}

function failure(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback
}

/** `neighbours`: the other operations on screen, which an answer may settle too (the month's). */
export function useBankAnswers(neighbours: () => BankTransactionItem[] | undefined = () => undefined) {
  const bank = useBankStore()
  const types = useCashflowTypesStore()
  const recurring = useRecurringStore()
  const toast = useToast()

  /** The operation whose answer waits for the API: its row stands still meanwhile. */
  const busy = ref<string | null>(null)
  const error = ref<string | null>(null)
  toastWhileSet(error)

  // One answer said at a time: the next replaces it.
  let noticeId: number | null = null
  function notify(parts: ToastPart[], answered?: Answered): void {
    clearNotice()
    noticeId = toast.show(parts, answered && { action: { label: 'Annuler', run: () => void undo(answered) } })
  }
  function clearNotice(): void {
    if (noticeId !== null) toast.dismiss(noticeId)
    noticeId = null
  }

  /** `outranked`: the rule written by hand the answer now comes before, by its title — never silent. */
  function typed(
    result: BankTransactionTypeResult, transactionIds = [result.transaction.id], outranked: string | null = null,
  ): void {
    const count = result.covered_count
    const label = CASHFLOW_TYPE_LABELS[result.transaction.cashflow_type]
    // Kept to the operations answered, there is no rule: undoing clears their own type.
    const ruleId = result.transaction.type_rule_id
    notify([
      `${count} opération${count > 1 ? 's' : ''} comptée${count > 1 ? 's' : ''} en ${label}.`,
      ...(ruleId ? [' Règle créée, dans ', { label: 'Règles de tri', to: RULES_PAGE }, '.'] : []),
      ...(outranked ? [` ${ruleId ? 'Pour ce libellé, elle' : 'Ce choix'} passe avant la règle ${outranked}.`] : []),
    ], { ruleId, transactionIds })
  }

  async function answer(
    tx: BankTransactionItem, type: CashflowType, scope: TypeScope, picked: string[], members: BankTransactionItem[] = [],
  ): Promise<void> {
    error.value = null
    // The operation asked about may have been unticked: the first ticked one carries the answer.
    const [first = tx.id, ...also] = picked
    try {
      const result = await bank.answering(
        typeAnswerEffect(tx, type, scope, [first, ...also], members, neighbours()),
        () => types.answerFlow(first, type, scope, also),
      )
      typed(result, scope === 'operation' ? [first, ...also] : [result.transaction.id])
    } catch (e) {
      error.value = failure(e, "Impossible d'enregistrer cette réponse.")
    }
  }

  /** Yes or no to the deposit or withdrawal facing the operation, or each of those ticked. */
  async function contribution(
    tx: BankTransactionItem, kind: BankContributionDecisionKind, answers = ownAnswer(tx), members: BankTransactionItem[] = [],
  ): Promise<void> {
    const [first, ...also] = answers
    if (!first) return
    error.value = null
    const ids = answers.map((answer) => answer.transaction_id)
    try {
      await bank.answering(
        contributionAnswerEffect(tx, kind, ids, members, neighbours()),
        () => bank.decideContribution(first.transaction_id, first.contribution_id, kind, also),
      )
      notify([contributionMessage(kind, keptByHand(tx, ids, members))], { ruleId: null, transactionIds: ids, contribution: true })
    } catch (e) {
      error.value = failure(e, "Impossible d'enregistrer cette réponse.")
    }
  }

  async function decide(tx: BankTransactionItem, kind: BankTransferDecisionKind): Promise<void> {
    const other = tx.transfer_id
    if (!other) return
    error.value = null
    try {
      await bank.answering(transferAnswerEffect(tx, kind), () => bank.decideTransfer(tx.id, other, kind))
    } catch (e) {
      error.value = failure(e, "Impossible d'enregistrer ce choix.")
    }
  }

  /** The offered pair made with another operation as close, the one the user picked. */
  async function pick(tx: BankTransactionItem, otherId: string): Promise<void> {
    busy.value = tx.id
    error.value = null
    try {
      await bank.decideTransfer(tx.id, otherId, 'transfer')
    } catch (e) {
      error.value = failure(e, "Impossible d'enregistrer ce choix.")
    } finally {
      busy.value = null
    }
  }

  async function subscribe(tx: BankTransactionItem, decision: RecurringDecisionKind): Promise<void> {
    error.value = null
    const kind = tx.recurring_question?.direction === 'income' ? 'revenus' : 'paiements'
    try {
      await bank.answering(recurringAnswerEffect(tx), () => recurring.decide(tx.id, decision))
      // Said only: a recurring answer is taken back from its own tab.
      notify([decision === 'confirm' ? `Compté dans vos ${kind} récurrents.` : 'Ne sera plus proposé comme récurrent.'])
    } catch (e) {
      error.value = failure(e, "Impossible d'enregistrer cette réponse.")
    }
  }

  /** Withdraws the decisions of these kinds the history holds on these operations. */
  async function undoHistory(kinds: BankHistoryKind[], transactionIds: string[]): Promise<void> {
    const decisions = (await types.fetchHistory()).filter(
      (item) => kinds.includes(item.kind) && item.operations.some((op) => transactionIds.includes(op.id)),
    )
    for (const decision of decisions) await types.undoAnswer(decision)
  }

  async function undo(answered: Answered): Promise<void> {
    noticeId = null
    try {
      if (answered.contribution) await undoHistory(['contribution', 'not_contribution'], answered.transactionIds)
      else if (answered.ruleId) await types.deleteRule(answered.ruleId)
      else await types.clearOverride(...answered.transactionIds)
    } catch (e) {
      error.value = failure(e, "Impossible d'annuler cette réponse.")
    }
  }

  return { busy, error, typed, clearNotice, answer, contribution, decide, pick, subscribe }
}
