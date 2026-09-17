import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'

import { apiClient } from '@/api/client'
import { hydrate, type LedgerEntry } from '@/utils/ledger'
import type { BankLedger } from '@/types'

/**
 * Every operation, typed, for the Explorer. Asked again on every visit and
 * after every write: the API answers 304 through the browser's cache while
 * nothing changed, so a reload costs a round trip, not the history.
 */
export const useLedgerStore = defineStore('ledger', () => {
  // Shallow: thousands of rows are replaced whole, never edited in place.
  const ledger = shallowRef<BankLedger | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  let latest = 0

  const entries = computed<LedgerEntry[]>(() => (ledger.value ? hydrate(ledger.value) : []))

  async function fetchLedger(): Promise<void> {
    const request = ++latest
    loading.value = true
    error.value = null
    try {
      const answer = await apiClient.get<BankLedger>('/banking/ledger')
      if (request === latest) ledger.value = answer
    } catch (e) {
      if (request === latest) error.value = e instanceof Error ? e.message : 'Impossible de charger les opérations.'
    } finally {
      if (request === latest) loading.value = false
    }
  }

  function reset(): void {
    ledger.value = null
    error.value = null
    latest += 1
  }

  return { ledger, entries, loading, error, fetchLedger, reset }
})
