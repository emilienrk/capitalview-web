/**
 * Composable for toggling display currency between USD and EUR.
 *
 * Crypto data is stored/fetched in USD. This composable provides a reactive
 * toggle and a conversion helper so the UI can optionally display values in EUR.
 *
 * The choice is scoped per page: "USD" means dollars on Crypto but "native
 * currency" on Stock, so a native-currency choice on Stock must not drag Crypto
 * into dollars. The USD→EUR rate itself stays shared — it is the same rate, and
 * a shared TTL avoids fetching it twice.
 */

import { ref, computed, watch, type Ref } from 'vue'
import { apiClient } from '@/api/client'
import { useFormatters } from '@/composables/useFormatters'

export type DisplayCurrency = 'USD' | 'EUR'

/** Pages holding an independent currency preference. */
export type CurrencyScope = 'crypto' | 'stock'

export const DEFAULT_DISPLAY_CURRENCY: DisplayCurrency = 'EUR'

const STORAGE_KEY_PREFIX = 'capitalview:display-currency'

/** Fallback rate – mirrored from backend services/exchange_rate.py _FALLBACK_USD_EUR */
const DEFAULT_USD_EUR_RATE = 0.92

const storage: Storage | null = typeof localStorage === 'undefined' ? null : localStorage

function readStored(scope: CurrencyScope): DisplayCurrency {
  const value = storage?.getItem(`${STORAGE_KEY_PREFIX}:${scope}`)
  return value === 'USD' || value === 'EUR' ? value : DEFAULT_DISPLAY_CURRENCY
}

// Singleton state shared across all component instances, one ref per scope
const currencyByScope: Record<CurrencyScope, Ref<DisplayCurrency>> = {
  crypto: ref<DisplayCurrency>(readStored('crypto')),
  stock: ref<DisplayCurrency>(readStored('stock')),
}

// Persist through a watcher rather than the setters: Stock binds the ref
// directly with v-model, which never goes through setCurrency/toggleCurrency.
for (const [scope, currency] of Object.entries(currencyByScope)) {
  watch(currency, (value) => storage?.setItem(`${STORAGE_KEY_PREFIX}:${scope}`, value))
}

const usdToEurRate = ref<number>(DEFAULT_USD_EUR_RATE)
const rateLoading = ref(false)

// TTL guard: avoid redundant fetches during SPA navigation
const RATE_TTL_MS = 60 * 60 * 1000 // 1 hour
let lastFetchedAt = 0

/**
 * Fetch the live USD→EUR rate from the backend (single source of truth).
 * Respects a TTL to avoid redundant calls during SPA navigation.
 */
async function fetchRate(): Promise<void> {
  const now = Date.now()
  if (now - lastFetchedAt < RATE_TTL_MS) return

  rateLoading.value = true
  try {
    const data = await apiClient.get<{ from: string; to: string; rate: number }>(
      '/dashboard/exchange-rate?from_currency=USD&to_currency=EUR',
    )
    if (data?.rate && data.rate > 0) {
      usdToEurRate.value = data.rate
      lastFetchedAt = now
    }
  } catch {
    // Keep the default/previous rate
  } finally {
    rateLoading.value = false
  }
}

type NumericValue = number | string | null | undefined

export function useCurrencyToggle(scope: CurrencyScope = 'crypto') {
  const { formatCurrency } = useFormatters()
  const displayCurrency = currencyByScope[scope]

  /** Convert a USD value to the currently selected display currency. */
  function convertFromUsd(value: NumericValue): number | null {
    if (value === null || value === undefined) return null
    const n = typeof value === 'string' ? Number(value) : value
    if (isNaN(n)) return null

    if (displayCurrency.value === 'EUR') {
      return n * usdToEurRate.value
    }
    return n
  }

  /** Format a USD-denominated value in the currently selected display currency. */
  function formatUsdValue(value: NumericValue): string {
    return formatCurrency(convertFromUsd(value), activeCurrency.value)
  }

  /** The currency code to pass to formatCurrency(). */
  const activeCurrency = computed(() => displayCurrency.value)

  function toggleCurrency(): void {
    displayCurrency.value = displayCurrency.value === 'USD' ? 'EUR' : 'USD'
  }

  function setCurrency(c: DisplayCurrency): void {
    displayCurrency.value = c
  }

  return {
    displayCurrency,
    activeCurrency,
    usdToEurRate,
    rateLoading,
    fetchRate,
    convertFromUsd,
    formatUsdValue,
    toggleCurrency,
    setCurrency,
  }
}
