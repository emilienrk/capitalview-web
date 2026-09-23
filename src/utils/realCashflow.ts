import type { RealCashflowCoverageGap, RealCashflowTotals, RealCashflowYear } from '@/types'

export type CashflowView = 'planned' | 'real' | 'explore'
export type MonthlyStatistic = 'mean' | 'median'

const VIEW_STORAGE_KEY = 'cashflow:view'

/**
 * The year the real view opens on: the current one once a month of it is
 * over, the previous one in January — a year with nothing completed has
 * nothing to show.
 */
export function defaultYear(today: Date = new Date()): number {
  return today.getMonth() === 0 ? today.getFullYear() - 1 : today.getFullYear()
}

export function monthlyFigures(year: RealCashflowYear, statistic: MonthlyStatistic): RealCashflowTotals {
  return statistic === 'median' ? year.monthly_median : year.monthly_mean
}

/**
 * What the banner says while answers can still move the figures; null once
 * nothing is open. Euros first: 188 operations says nothing of whether they
 * matter, while the amount does. `amount` comes formatted, privacy included.
 */
export function openQuestionsNotice(count: number, amount: string): string | null {
  if (count <= 0) return null
  const operations = count === 1 ? '1 opération' : `${count} opérations`
  return `${amount} restent à confirmer (${operations}) : ces chiffres peuvent encore changer.`
}

/**
 * The change from `previous` to `current`, in percent; null when there is
 * nothing to compare against.
 */
export function changePercent(current: number, previous: number | null | undefined): number | null {
  if (previous === null || previous === undefined || Number(previous) === 0) return null
  return ((Number(current) - Number(previous)) / Math.abs(Number(previous))) * 100
}

/**
 * What a gap in an account's history means for the figures, in a sentence.
 * `format` renders a YYYY-MM-DD day.
 */
export function coverageNotice(gap: RealCashflowCoverageGap, format: (day: string) => string): string {
  const parts: string[] = []
  if (gap.starts_late) parts.push(`n'a d'opérations qu'à partir du ${format(gap.first_day)}`)
  if (gap.ends_early) parts.push(`n'est à jour qu'au ${format(gap.covered_until)}`)
  return `${gap.account_name} ${parts.join(' et ')} : un virement vers ce compte hors de cette plage compte en dépense.`
}

// Storage can be missing or throw (private browsing, blocked site data): the
// page then simply opens on the declared view.
export function readCashflowView(): CashflowView {
  try {
    const stored = localStorage.getItem(VIEW_STORAGE_KEY)
    return stored === 'real' || stored === 'explore' ? stored : 'planned'
  } catch {
    return 'planned'
  }
}

export function writeCashflowView(view: CashflowView): void {
  try {
    localStorage.setItem(VIEW_STORAGE_KEY, view)
  } catch {
    // Remembering the view is a convenience, never a requirement.
  }
}
