import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { apiClient } from '@/api/client'
import { useBankStore } from '@/stores/bank'
import type {
  BankHistoryItem, BankReviewQueue, BankTransactionItem, BankTransactionTypeResult, BankTypeRule, BankTypeRulePreview,
  BankTypeRuleWrite, CashflowType, TypeScope,
} from '@/types'
import { applyToQueue, waitingOn } from '@/utils/optimisticAnswers'

/** How operations count: the type of one of them, the rules of their labels. */
export const useCashflowTypesStore = defineStore('cashflowTypes', () => {
  const rules = ref<BankTypeRule[] | null>(null)
  const bank = useBankStore()
  /** The queue as fetched, and the revision it was asked at: the answers given since read on top. */
  const queueRead = ref<{ queue: BankReviewQueue; revision: number } | null>(null)
  const queue = computed(() =>
    queueRead.value ? applyToQueue(queueRead.value.queue, bank.answersSince(queueRead.value.revision)) : null,
  )
  /** Questions answered on part of their operations: answered again once the reload says what is left. */
  const queueWaiting = computed(() => waitingOn(queueRead.value ? bank.answersSince(queueRead.value.revision) : []))
  /** The year the queue was last asked for, null for every year. */
  const queueYear = ref<number | null>(null)

  async function setType(
    transactionId: string, type: CashflowType, scope: TypeScope, also: string[] = [],
  ): Promise<BankTransactionTypeResult> {
    const result = await apiClient.put<BankTransactionTypeResult>(
      `/banking/transactions/${encodeURIComponent(transactionId)}/type`,
      also.length ? { type, scope, also } : { type, scope },
    )
    changed()
    return result
  }

  /**
   * Answering a flow question types this operation alone, the others of its
   * label the user ticked (`also`, no rule written), or the whole label —
   * every operation of it, and those imported later.
   */
  function answerFlow(
    transactionId: string,
    type: CashflowType,
    scope: TypeScope = 'operation',
    also: string[] = [],
  ): Promise<BankTransactionTypeResult> {
    return setType(transactionId, type, scope, scope === 'operation' ? also : [])
  }

  /** Drops what the user forced on these operations, in one refresh. */
  async function clearOverride(...transactionIds: string[]): Promise<void> {
    await Promise.all(transactionIds.map((id) =>
      apiClient.delete<BankTransactionItem>(`/banking/transactions/${encodeURIComponent(id)}/type`),
    ))
    changed()
  }

  async function fetchRules(): Promise<void> {
    rules.value = await apiClient.get<BankTypeRule[]>('/banking/type-rules')
  }

  /** What a rule written by hand would type, nothing written; `replacing` is the rule it edits. */
  function previewRule(rule: BankTypeRuleWrite, replacing: string | null = null): Promise<BankTypeRulePreview> {
    const query = replacing ? `?replacing=${encodeURIComponent(replacing)}` : ''
    return apiClient.post<BankTypeRulePreview>(`/banking/type-rules/preview${query}`, rule)
  }

  /** Writes a rule by hand, in place of `replacing` when it edits one (it comes back under a new id). */
  async function writeRule(rule: BankTypeRuleWrite, replacing: string | null = null): Promise<BankTypeRule> {
    const saved = replacing
      ? await apiClient.put<BankTypeRule>(`/banking/type-rules/${encodeURIComponent(replacing)}`, rule)
      : await apiClient.post<BankTypeRule>('/banking/type-rules', rule)
    changed()
    // Read again whole: a new rule can take operations from the others.
    await fetchRules()
    return saved
  }

  /** Gives a rule another type: it comes back under a new id. */
  async function retypeRule(ruleId: string, type: CashflowType): Promise<BankTypeRule> {
    const rule = await apiClient.patch<BankTypeRule>(`/banking/type-rules/${encodeURIComponent(ruleId)}`, { type })
    if (rules.value) rules.value = rules.value.map((other) => (other.id === ruleId ? rule : other))
    changed()
    return rule
  }

  async function deleteRule(ruleId: string): Promise<void> {
    await apiClient.delete(`/banking/type-rules/${encodeURIComponent(ruleId)}`)
    if (rules.value) rules.value = rules.value.filter((rule) => rule.id !== ruleId)
    changed()
  }

  /** The operations one answer would type: exactly what the question counts. */
  function fetchFlowGroup(transactionId: string): Promise<BankTransactionItem[]> {
    return apiClient.get<BankTransactionItem[]>(
      `/banking/transactions/${encodeURIComponent(transactionId)}/flow-group`,
    )
  }

  /** Every answer still in force, newest first. */
  function fetchHistory(): Promise<BankHistoryItem[]> {
    return apiClient.get<BankHistoryItem[]>('/banking/history')
  }

  /** Withdraws one answer: the operations read as they did before it. */
  async function undoAnswer(item: Pick<BankHistoryItem, 'kind' | 'id'>): Promise<void> {
    await apiClient.delete(`/banking/history/${item.kind}/${encodeURIComponent(item.id)}`)
    changed()
  }

  /** Every open question, heaviest first; the year narrows the list, never the years offered. */
  async function fetchReviewQueue(year: number | null = null): Promise<void> {
    queueYear.value = year
    const revision = bank.dataRevision
    const answer = await apiClient.get<BankReviewQueue>(
      year === null ? '/banking/review-queue' : `/banking/review-queue?year=${year}`,
    )
    // A slower answer for another year never replaces the one asked last.
    if (queueYear.value === year) queueRead.value = { queue: answer, revision }
  }

  function changed(): void {
    bank.operationsRead()
  }

  function reset(): void {
    rules.value = null
    queueRead.value = null
    queueYear.value = null
  }

  return {
    rules, queue, queueWaiting, queueYear, setType, answerFlow, clearOverride, fetchRules, previewRule, writeRule, retypeRule,
    deleteRule, fetchFlowGroup,
    fetchHistory, undoAnswer, fetchReviewQueue, reset,
  }
})
