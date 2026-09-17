import { defineStore } from 'pinia'
import { ref } from 'vue'

import { apiClient } from '@/api/client'
import { useBankStore } from '@/stores/bank'
import type {
  BankReviewQueue, BankTransactionItem, BankTransactionTypeResult, BankTypeRule, CashflowType, TypeScope,
} from '@/types'

/** How operations count: the type of one of them, the rules of their labels. */
export const useCashflowTypesStore = defineStore('cashflowTypes', () => {
  const rules = ref<BankTypeRule[] | null>(null)
  const queue = ref<BankReviewQueue | null>(null)
  /** The year the queue was last asked for, null for every year. */
  const queueYear = ref<number | null>(null)

  async function setType(transactionId: string, type: CashflowType, scope: TypeScope): Promise<BankTransactionTypeResult> {
    const result = await apiClient.put<BankTransactionTypeResult>(
      `/banking/transactions/${encodeURIComponent(transactionId)}/type`,
      { type, scope },
    )
    changed()
    return result
  }

  /** Answering a flow question types the label: every operation of it, and those imported later. */
  function answerFlow(transactionId: string, type: CashflowType): Promise<BankTransactionTypeResult> {
    return setType(transactionId, type, 'label')
  }

  async function clearOverride(transactionId: string): Promise<BankTransactionItem> {
    const item = await apiClient.delete<BankTransactionItem>(
      `/banking/transactions/${encodeURIComponent(transactionId)}/type`,
    )
    changed()
    return item
  }

  async function fetchRules(): Promise<void> {
    rules.value = await apiClient.get<BankTypeRule[]>('/banking/type-rules')
  }

  async function deleteRule(ruleId: string): Promise<void> {
    await apiClient.delete(`/banking/type-rules/${encodeURIComponent(ruleId)}`)
    if (rules.value) rules.value = rules.value.filter((rule) => rule.id !== ruleId)
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
    rules, queue, queueYear, setType, answerFlow, clearOverride, fetchRules, deleteRule, fetchReviewQueue, reset,
  }
})
