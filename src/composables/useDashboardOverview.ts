import { computed, reactive, ref } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import { useBankStore } from '@/stores/bank'
import { useDashboardStore } from '@/stores/dashboard'
import { useRealCashflowStore } from '@/stores/realCashflow'
import { useSettingsStore } from '@/stores/settings'
import { useWealthHistoryStore } from '@/stores/wealthHistory'
import { buildComposition } from '@/utils/netWorth'
import type { RealCashflowYear } from '@/types'

export interface AttentionItem {
  key: string
  label: string
  to: RouteLocationRaw
  /** A failure to act on, rather than work waiting to be done. */
  urgent: boolean
}

export interface InvestmentRow {
  key: 'stock' | 'crypto' | 'placements'
  label: string
  value: number
  invested: number
  gain: number
  percent: number | null
}

/**
 * Everything both dashboard layouts show, loaded once and derived once: the
 * phone and the desktop arrange the same figures differently, they never
 * compute them differently.
 */
export function useDashboardOverview() {
  const dashboard = useDashboardStore()
  const historyStore = useWealthHistoryStore()
  const bank = useBankStore()
  const realCashflow = useRealCashflowStore()
  const settingsStore = useSettingsStore()

  const bankEnabled = computed(() => settingsStore.settings?.bank_module_enabled ?? true)
  const wealthEnabled = computed(() => settingsStore.settings?.wealth_module_enabled ?? true)
  const year = new Date().getFullYear()
  const yearSummary = ref<RealCashflowYear | null>(null)

  async function load(force = false): Promise<void> {
    const settings = settingsStore.settings
    const requests: Promise<unknown>[] = [dashboard.fetchAll(settings), historyStore.fetchHistory(force)]
    if (bankEnabled.value) {
      requests.push(
        bank.fetchTransferQuestions(),
        realCashflow.fetchCurrent(force),
        realCashflow.fetchYearSummary(year, force).then((summary) => {
          yearSummary.value = summary
        }),
      )
    }
    await Promise.all(requests)
  }

  const total = computed(() => {
    const value = dashboard.statistics?.wealth.total_wealth
    return value == null ? null : Number(value)
  })

  const composition = computed(() =>
    dashboard.statistics
      ? buildComposition(dashboard.statistics, { bankEnabled: bankEnabled.value, wealthEnabled: wealthEnabled.value })
      : [],
  )

  const changes = computed(() => dashboard.statistics?.changes ?? [])

  /** The API counts cash at zero when a held currency has no rate: the total is then short, and says so. */
  const cashUncounted = computed(() => bankEnabled.value && dashboard.bankAccounts != null && dashboard.bankAccounts.total_balance === null)

  const bankAccounts = computed(() => dashboard.bankAccounts?.accounts ?? [])

  /** The most recent successful sync across linked accounts; null when none is linked. */
  const lastSync = computed(() => {
    const dates = bankAccounts.value.filter((a) => a.is_linked && a.last_synced_at).map((a) => a.last_synced_at as string)
    return dates.length ? dates.sort()[dates.length - 1] ?? null : null
  })

  const attention = computed<AttentionItem[]>(() => {
    const items: AttentionItem[] = []
    for (const account of bankAccounts.value) {
      if (account.link_status === 'reconnect_required') {
        items.push({ key: `reconnect:${account.id}`, label: `${account.name} : à reconnecter`, to: { name: 'bank' }, urgent: true })
      } else if (account.sync_error) {
        items.push({ key: `sync:${account.id}`, label: `${account.name} : synchro en échec`, to: { name: 'bank' }, urgent: true })
      }
    }
    const stale = yearSummary.value?.safety_net?.stale_accounts ?? []
    if (stale.length) {
      items.push({
        key: 'stale',
        // The API lists manual accounts here too: "synced" would be wrong for them.
        label: `Solde non mis à jour depuis une semaine : ${stale.join(', ')}`,
        to: { name: 'bank' },
        urgent: false,
      })
    }
    const questions = bank.transferQuestions
    if (bankEnabled.value && questions?.total) {
      items.push({
        key: 'review',
        label: `${questions.total} opération${questions.total > 1 ? 's' : ''} à trier`,
        to: { name: 'bank-review' },
        urgent: false,
      })
    }
    if (bankEnabled.value && questions?.recurring) {
      items.push({
        key: 'recurring',
        label: `${questions.recurring} récurrent${questions.recurring > 1 ? 's' : ''} à confirmer`,
        to: { name: 'bank-recurring' },
        urgent: false,
      })
    }
    return items
  })

  const investmentRows = computed<InvestmentRow[]>(() => {
    const d = dashboard.statistics?.distribution
    if (!d) return []
    const rows: Array<[InvestmentRow['key'], string, number, number]> = [
      ['stock', 'Bourse', Number(d.stock_current_value ?? 0), Number(d.stock_invested ?? 0)],
      ['crypto', 'Crypto', Number(d.crypto_current_value ?? 0), Number(d.crypto_invested ?? 0)],
      ['placements', 'Placements', Number(d.placements_current_value ?? 0), Number(d.placements_invested ?? 0)],
    ]
    return rows
      .filter(([, , value, invested]) => value !== 0 || invested !== 0)
      .map(([key, label, value, invested]) => ({
        key,
        label,
        value,
        invested,
        gain: value - invested,
        percent: invested > 0 ? ((value - invested) / invested) * 100 : null,
      }))
  })

  return reactive({
    bankEnabled,
    wealthEnabled,
    year,
    load,
    isLoading: computed(() => dashboard.isLoading),
    error: computed(() => dashboard.error),
    pricesLive: computed(() => dashboard.pricesLive),
    total,
    composition,
    changes,
    cashUncounted,
    portfolio: computed(() => dashboard.portfolio),
    bankLoaded: computed(() => dashboard.bankAccounts !== null),
    bankTotal: computed(() => dashboard.bankAccounts?.total_balance ?? null),
    bankAccounts,
    lastSync,
    attention,
    investmentRows,
    month: computed(() => realCashflow.current),
    yearSummary,
    history: computed(() => historyStore.history ?? []),
    historyLoading: computed(() => historyStore.isLoading),
    historyError: computed(() => historyStore.error),
    hasMeaningfulHistory: computed(() => historyStore.hasMeaningfulHistory),
  })
}

export type DashboardOverview = ReturnType<typeof useDashboardOverview>
