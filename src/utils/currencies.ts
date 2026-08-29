/**
 * The currencies the app knows about, in one place.
 *
 * The API owns the list (`GET /market/currencies`, backed by `models/currency.py`).
 * The values below are the same list, held statically so the synchronous callers
 * — `isFiatSymbol` runs inside render paths — keep working before any fetch has
 * happened, and so a network hiccup never empties a currency picker.
 *
 * `loadSupportedCurrencies()` refreshes them from the API. Anything that can
 * await should read `supportedCurrencies` after calling it; anything that
 * cannot reads the static values and is correct until the API's list changes.
 *
 * See the API's docs/currencies.md for what belongs in the list.
 */
import { ref } from 'vue'
import { apiClient } from '@/api/client'

export interface CurrencyOption {
  code: string
  name: string
}

/** The currency every total, curve and aggregate is expressed in. */
export const BASE_CURRENCY = 'EUR'

const STATIC_CURRENCIES: CurrencyOption[] = [
  { code: 'EUR', name: 'Euro' },
  { code: 'USD', name: 'Dollar américain' },
  { code: 'GBP', name: 'Livre sterling' },
  { code: 'CHF', name: 'Franc suisse' },
  { code: 'CAD', name: 'Dollar canadien' },
  { code: 'JPY', name: 'Yen japonais' },
  { code: 'AUD', name: 'Dollar australien' },
  { code: 'NZD', name: 'Dollar néo-zélandais' },
  { code: 'SEK', name: 'Couronne suédoise' },
  { code: 'NOK', name: 'Couronne norvégienne' },
  { code: 'DKK', name: 'Couronne danoise' },
  { code: 'CNY', name: 'Yuan chinois' },
]

export const supportedCurrencies = ref<CurrencyOption[]>([...STATIC_CURRENCIES])

/** Codes only, for membership tests. Kept in step with `supportedCurrencies`. */
export const currencyCodes = ref<Set<string>>(new Set(STATIC_CURRENCIES.map((c) => c.code)))

let inFlight: Promise<void> | null = null

/** Refresh from the API. Fetched once per page load; failures keep the static list. */
export function loadSupportedCurrencies(): Promise<void> {
  if (inFlight) return inFlight
  inFlight = apiClient
    .get<{ base: string; currencies: CurrencyOption[] }>('/market/currencies')
    .then((data) => {
      if (!data?.currencies?.length) return
      supportedCurrencies.value = data.currencies
      currencyCodes.value = new Set(data.currencies.map((c) => c.code))
    })
    .catch(() => {
      // The static list is a correct answer, just possibly an older one.
      inFlight = null
    })
  return inFlight
}

/** Options shaped for BaseSelect, e.g. "Dollar américain (USD)". */
export function currencyOptions(): { label: string; value: string }[] {
  return supportedCurrencies.value.map((c) => ({ label: `${c.name} (${c.code})`, value: c.code }))
}
