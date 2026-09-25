import { defineStore } from 'pinia'
import { ref } from 'vue'

import { apiClient } from '@/api/client'
import { useBankStore } from '@/stores/bank'
import type {
  BankRecurringItem, BankRecurringUpdate, BankRecurringResponse, BankTransactionItem,
  RecurringCadence, RecurringDecisionKind, RecurringDirection, RecurringOperationAction,
} from '@/types'

/**
 * The recurring charges and income found in the operations, and what the user
 * decided about them. The API lists one direction at a time.
 */
export const useRecurringStore = defineStore('recurring', () => {
  const lists = ref<Record<RecurringDirection, BankRecurringResponse | null>>({ expense: null, income: null })

  async function fetchList(direction: RecurringDirection = 'expense'): Promise<void> {
    lists.value[direction] = await apiClient.get<BankRecurringResponse>(`/banking/recurring?direction=${direction}`)
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

  /** One counted without asking has no decision yet to edit: saying yes makes it. */
  async function decisionId(item: Pick<BankRecurringItem, 'id' | 'transaction_id'>): Promise<string> {
    if (item.id) return item.id
    const decided = await decide(item.transaction_id, 'confirm')
    if (!decided?.id) throw new Error("Impossible d'enregistrer ce choix.")
    return decided.id
  }

  /** An operation the detection left out: a debit makes a payment, a credit an income. */
  async function mark(transactionId: string, cadence?: RecurringCadence, name?: string): Promise<BankRecurringItem | null> {
    const item = await apiClient.post<BankRecurringItem | null>('/banking/recurring', {
      transaction_id: transactionId, cadence, name,
    })
    changed()
    return item
  }

  async function update(id: string, data: BankRecurringUpdate): Promise<void> {
    await apiClient.patch(`/banking/recurring/${encodeURIComponent(id)}`, data)
    changed()
  }

  /** Attaches an operation the detection missed, or detaches one it took, for good. */
  async function correct(id: string, transactionId: string, action: RecurringOperationAction): Promise<void> {
    await apiClient.post(`/banking/recurring/${encodeURIComponent(id)}/operations`, {
      transaction_id: transactionId, action,
    })
    changed()
  }

  /** One of two: the other one, decided or reached through its last operation, goes. */
  async function merge(id: string, other: Pick<BankRecurringItem, 'id' | 'transaction_id'>): Promise<void> {
    await apiClient.post(
      `/banking/recurring/${encodeURIComponent(id)}/merge`,
      other.id ? { other_id: other.id } : { other_transaction_id: other.transaction_id },
    )
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

  // A decision moves the questions, the recurring share of the expenses and
  // the income, and the lists: everything listening to `dataRevision` reloads.
  function changed(): void {
    useBankStore().operationsRead()
  }

  function reset(): void {
    lists.value = { expense: null, income: null }
  }

  return { lists, fetchList, decide, decisionId, mark, update, correct, merge, remove, fetchOperations, reset }
})
