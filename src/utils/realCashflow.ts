import type { RealCashflowTotals, RealCashflowYear } from '@/types'

export type CashflowView = 'planned' | 'real'
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

/** What the banner says while answers can still move the figures; null once nothing is open. */
export function openQuestionsNotice(count: number): string | null {
  if (count <= 0) return null
  return count === 1
    ? '1 point à confirmer peut encore changer ces chiffres.'
    : `${count} points à confirmer peuvent encore changer ces chiffres.`
}

// Storage can be missing or throw (private browsing, blocked site data): the
// page then simply opens on the declared view.
export function readCashflowView(): CashflowView {
  try {
    return localStorage.getItem(VIEW_STORAGE_KEY) === 'real' ? 'real' : 'planned'
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
