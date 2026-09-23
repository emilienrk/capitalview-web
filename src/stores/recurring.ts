import { defineStore } from 'pinia'
import { ref } from 'vue'

import { apiClient } from '@/api/client'
import { useBankStore } from '@/stores/bank'
import type {
  BankRecurringItem, BankRecurringUpdate, BankRecurringResponse, BankTransactionItem,
  RecurringDecisionKind,
} from '@/types'

/** The recurring charges found in the operations, and what the user decided about them. */
export const useRecurringStore = defineStore('recurring', () => {
  const list = ref<BankRecurringResponse | null>(null)

  async function fetchList(): Promise<void> {
    list.value = await apiClient.get<BankRecurringResponse>('/banking/recurring')
  }

  /** Yes or no to the series the operation belongs to; the refusal is kept. */
  async function decide(
    transactionId: string, decision: RecurringDecisionKind, name?: string,
  ): Promise<BankRecurringItem | null> {
    const item = await apiClient.post<BankRecurringItem | null>('/banking/recurring/decisions', {
      transaction_id: transactionId, decision, name,
    })
    changed()
    return item
  }

  async function update(id: string, data: BankRecurringUpdate): Promise<void> {
    await apiClient.patch(`/banking/recurring/${encodeURIComponent(id)}`, data)
    changed()
  }

  /** Forgets the decision: the series is found again, asked about again if unsure. */
  async function remove(id: string): Promise<void> {
    await apiClient.delete(`/banking/recurring/${encodeURIComponent(id)}`)
    changed()
  }

  /** Its operations, most recent first; a series never decided is reached through one of them. */
  function fetchOperations(item: Pick<BankRecurringItem, 'id' | 'transaction_id'>): Promise<BankTransactionItem[]> {
    return apiClient.get<BankTransactionItem[]>(
      item.id
        ? `/banking/recurring/${encodeURIComponent(item.id)}/operations`
        : `/banking/recurring/operations?transaction_id=${encodeURIComponent(item.transaction_id)}`,
    )
  }

  // A decision moves the questions, the expenses' recurring share and the
  // list: everything listening to `dataRevision` reloads.
  function changed(): void {
    useBankStore().operationsRead()
  }

  function reset(): void {
    list.value = null
  }

  return { list, fetchList, decide, update, remove, fetchOperations, reset }
})
