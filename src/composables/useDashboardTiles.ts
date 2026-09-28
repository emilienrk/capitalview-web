import { computed } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import { useDisplayLocale } from '@/composables/useDisplayLocale'
import { useFormatters } from '@/composables/useFormatters'
import { usePrivacyMode } from '@/composables/usePrivacyMode'
import type { DashboardOverview } from '@/composables/useDashboardOverview'
import { exploreLink } from '@/utils/ledger'

export interface TileContent {
  key: string
  label: string
  value: string
  detail?: string
  detailClass?: string
  note?: string
  to?: RouteLocationRaw
}

/** The secondary figures, worded once for both layouts. */
export function useDashboardTiles(overview: DashboardOverview) {
  const { formatCurrency, formatPercent, profitLossClass } = useFormatters()
  const { maskValue } = usePrivacyMode()
  const { effectiveLocale } = useDisplayLocale()

  function eur(value: number | string | null | undefined): string {
    return maskValue(formatCurrency(value))
  }

  function signed(value: number): string {
    return `${value < 0 ? '−' : '+'}${eur(Math.abs(value))}`
  }

  function day(value: string): string {
    return new Intl.DateTimeFormat(effectiveLocale.value, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
      new Date(`${value.slice(0, 10)}T00:00:00Z`),
    )
  }

  const portfolio = computed<TileContent | null>(() => {
    const p = overview.portfolio
    if (!p || (!Number(p.total_invested) && p.current_value === null)) return null
    const gain = p.profit_loss === null ? null : Number(p.profit_loss)
    return {
      key: 'portfolio',
      label: 'Bourse et crypto',
      value: eur(p.current_value ?? p.total_invested),
      detail: gain === null ? undefined : `${signed(gain)} (${formatPercent(p.profit_loss_percentage)})`,
      detailClass: profitLossClass(gain),
      note: `Investi ${eur(p.total_invested)}, plus-value sur le PRU`,
      to: { name: 'stock' },
    }
  })

  const cash = computed<TileContent | null>(() => {
    if (!overview.bankEnabled || !overview.bankLoaded) return null
    const linked = overview.bankAccounts.some((account) => account.is_linked)
    return {
      key: 'cash',
      label: 'Comptes bancaires',
      value: overview.bankTotal === null ? '—' : eur(overview.bankTotal),
      note: overview.bankTotal === null
        ? 'Total impossible : une devise sans cours'
        : overview.lastSync
          ? `Dernière synchro le ${day(overview.lastSync)}`
          : linked ? 'Jamais synchronisé' : 'Soldes saisis à la main',
      to: { name: 'bank' },
    }
  })

  const month = computed<TileContent | null>(() => {
    const m = overview.month
    if (!overview.bankEnabled || !m) return null
    const gap = m.median_to_date === null ? null : Number(m.spent_to_date) - Number(m.median_to_date)
    const upcoming = m.upcoming?.length ?? 0
    return {
      key: 'month',
      label: 'Dépensé ce mois',
      value: maskValue(formatCurrency(m.spent_to_date, m.currency)),
      detail: gap === null ? `au ${m.day}` : `${signed(gap)} face au mois médian`,
      // Spending less than usual is the good direction.
      detailClass: gap === null ? undefined : profitLossClass(-gap),
      note: upcoming
        ? `${upcoming} prélèvement${upcoming > 1 ? 's' : ''} à venir, ${maskValue(formatCurrency(m.upcoming_amount, m.currency))}`
        : undefined,
      to: { name: 'cashflow', query: exploreLink({ preset: 'month', direction: 'out', types: ['EXPENSE'], includePending: true }) },
    }
  })

  const savings = computed<TileContent | null>(() => {
    const summary = overview.yearSummary
    if (!overview.bankEnabled || !summary) return null
    const rate = summary.totals.savings_rate
    const months = summary.covered_months
    return {
      key: 'savings',
      label: `Taux d'épargne ${summary.year}`,
      value: rate === null ? '—' : `${Number(rate).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`,
      detail: months ? `${signed(Number(summary.totals.cashflow))} non dépensés` : undefined,
      detailClass: months ? profitLossClass(Number(summary.totals.cashflow)) : undefined,
      note: months
        ? `Mesuré sur ${months} mois terminé${months > 1 ? 's' : ''}`
        : 'Aucun mois terminé cette année',
      to: { name: 'cashflow' },
    }
  })

  return { portfolio, cash, month, savings }
}
