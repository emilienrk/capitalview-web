import type { AccountHistorySnapshotResponse, StockAccountType } from '@/types'

export const PEA_DEPOSIT_CEILING = 150_000
/** PEA and PEA-PME share this ceiling on their combined deposits. */
export const PEA_PEA_PME_DEPOSIT_CEILING = 225_000

export function hasDepositCeiling(type: StockAccountType | string): boolean {
  return type === 'PEA' || type === 'PEA_PME'
}

/**
 * The fifth anniversary of a PEA, as 'YYYY-MM-DD', while it is still ahead:
 * withdrawing before it closes the plan. Null once it has passed, or when the
 * opening date is unknown.
 */
export function fiveYearMark(openedAt: string | null | undefined, today: string): string | null {
  if (!openedAt) return null
  const [year, month, day] = openedAt.slice(0, 10).split('-').map(Number)
  if (!year || !month || !day) return null
  const mark = `${year + 5}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  return mark > today ? mark : null
}

export interface DepositCeilingReading {
  ceiling: number
  /** Deposits counted against the ceiling: this account's, plus the PEA's for a PEA-PME. */
  counted: number
  /** Set when negative cash proves deposits are missing: counted is then a floor. */
  atLeast: number | null
  /** Shares of the ceiling, 0–1: what was recorded, then what must be missing. */
  recordedShare: number
  missingShare: number
  remaining: number
}

/**
 * Where a PEA or PEA-PME stands against its legal deposit ceiling.
 *
 * `otherDeposits` is the sister plan's: the PEA-PME's for a PEA, the PEA's for
 * a PEA-PME. Negative cash means buys were paid with money never recorded as
 * deposited, so the deposits read as a minimum rather than a figure.
 */
export function readDepositCeiling(
  type: StockAccountType | string,
  deposits: number,
  cashBalance: number,
  otherDeposits = 0,
): DepositCeilingReading | null {
  if (!hasDepositCeiling(type)) return null
  const missing = cashBalance < 0 ? -cashBalance : 0
  const own = deposits + missing
  const combinedLeft = PEA_PEA_PME_DEPOSIT_CEILING - own - otherDeposits

  const isPea = type === 'PEA'
  const ceiling = isPea ? PEA_DEPOSIT_CEILING : PEA_PEA_PME_DEPOSIT_CEILING
  const recorded = isPea ? deposits : deposits + otherDeposits
  const remaining = isPea ? Math.min(PEA_DEPOSIT_CEILING - own, combinedLeft) : combinedLeft

  const clamp = (share: number) => Math.min(Math.max(share, 0), 1)
  const recordedShare = clamp(recorded / ceiling)
  return {
    ceiling,
    counted: recorded,
    atLeast: missing ? recorded + missing : null,
    recordedShare,
    missingShare: clamp((recorded + missing) / ceiling) - recordedShare,
    remaining: Math.max(remaining, 0),
  }
}

export interface AccountHeadline {
  /** Holdings plus cash, the figure the account's curve ends on. */
  value: number
  profitLoss: number | null
  profitLossPct: number | null
}

/** The collapsed account's figures, read off its latest snapshot. */
export function accountHeadline(history: AccountHistorySnapshotResponse[]): AccountHeadline | null {
  const latest = history[history.length - 1]
  if (!latest) return null
  const holdings = (latest.positions ?? []).filter((p) => p.asset_key !== 'EUR')
  if (!holdings.length) return { value: Number(latest.total_value), profitLoss: null, profitLossPct: null }
  const value = holdings.reduce((sum, p) => sum + Number(p.value), 0)
  const invested = holdings.reduce((sum, p) => sum + Number(p.invested), 0)
  const profitLoss = value - invested
  return {
    value: Number(latest.total_value),
    profitLoss,
    profitLossPct: invested > 0 ? (profitLoss / invested) * 100 : null,
  }
}

export const STOCK_TX_TYPE_LABELS: Record<string, string> = {
  BUY: 'Achat',
  SELL: 'Vente',
  DIVIDEND: 'Dividende',
  DEPOSIT: 'Versement',
  WITHDRAW: 'Retrait',
}
