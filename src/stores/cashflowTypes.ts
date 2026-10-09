import { defineStore } from 'pinia'
import { ref } from 'vue'

import { apiClient } from '@/api/client'
import { useBankStore } from '@/stores/bank'
import type {
  BankHistoryItem, BankReviewQueue, BankTransactionItem, BankTransactionTypeResult, BankTypeRule, CashflowType, TypeScope,
} from '@/types'

/** How operations count: the type of one of them, the rules of their labels. */
export const useCashflowTypesStore = defineStore('cashflowTypes', () => {
  const rules = ref<BankTypeRule[] | null>(null)
  const queue = ref<BankReviewQueue | null>(null)
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
    const answer = await apiClient.get<BankReviewQueue>(
      year === null ? '/banking/review-queue' : `/banking/review-queue?year=${year}`,
    )
    // A slower answer for another year never replaces the one asked last.
    if (queueYear.value === year) queue.value = answer
  }

  function changed(): void {
    useBankStore().operationsRead()
  }

  function reset(): void {
    rules.value = null
    queue.value = null
    queueYear.value = null
  }

  return {
    rules, queue, queueYear, setType, answerFlow, clearOverride, fetchRules, deleteRule, fetchFlowGroup,
    fetchHistory, undoAnswer, fetchReviewQueue, reset,
  }
})
