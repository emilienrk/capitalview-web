import type { BankTransactionItem, CashflowType, OperationType } from '@/types'

export const CASHFLOW_TYPES: CashflowType[] = ['INCOME', 'EXPENSE', 'SAVING', 'INVESTMENT', 'NEUTRAL']

export const CASHFLOW_TYPE_LABELS: Record<CashflowType, string> = {
  INCOME: 'Entrée',
  EXPENSE: 'Dépense',
  SAVING: 'Épargne',
  INVESTMENT: 'Investissement',
  NEUTRAL: 'Neutre',
}

export const CASHFLOW_TYPE_TONES: Record<CashflowType, string> = {
  INCOME: 'bg-success/10 text-success',
  EXPENSE: 'bg-danger/10 text-danger',
  SAVING: 'bg-primary/10 text-primary',
  INVESTMENT: 'bg-info/10 text-info',
  NEUTRAL: 'bg-background-subtle dark:bg-background-dark-subtle text-text-muted dark:text-text-dark-muted',
}

export const OPERATION_TYPE_LABELS: Record<Exclude<OperationType, 'UNKNOWN'>, string> = {
  CARD: 'Carte',
  TRANSFER: 'Virement',
  DIRECT_DEBIT: 'Prélèvement',
  WITHDRAWAL: 'Retrait',
  INTEREST: 'Intérêts',
}

/**
 * What an answer means for this direction: a credit typed as an expense is a
 * refund, one typed as saving is money taken back from savings.
 */
export function answerLabel(type: CashflowType, isCredit: boolean): string {
  if (!isCredit) return CASHFLOW_TYPE_LABELS[type]
  const credit: Record<CashflowType, string> = {
    INCOME: 'Entrée',
    EXPENSE: 'Remboursement',
    SAVING: "Reprise d'épargne",
    INVESTMENT: "Reprise d'investissement",
    NEUTRAL: 'Neutre',
  }
  return credit[type]
}

/**
 * What an answer does to the figures, shown on hover rather than written out:
 * "Remboursement" is the one nobody guesses, and it is the answer most
 * received transfers deserve.
 */
export function answerHint(type: CashflowType, isCredit: boolean): string {
  if (type === 'NEUTRAL') return "Compté nulle part : de l'argent qui n'a fait que passer."
  const credit: Record<Exclude<CashflowType, 'NEUTRAL'>, string> = {
    INCOME: 'Compté dans vos entrées.',
    EXPENSE: 'Déduit des dépenses du mois où il arrive, sans chercher la dépense.',
    SAVING: 'Repris de votre épargne : baisse ce qui est mis de côté.',
    INVESTMENT: 'Repris de vos investissements.',
  }
  const debit: Record<Exclude<CashflowType, 'NEUTRAL'>, string> = {
    INCOME: 'Retiré de vos entrées.',
    EXPENSE: 'Compté dans vos dépenses.',
    SAVING: 'Mis de côté : ni dépensé, ni perdu.',
    INVESTMENT: 'Investi : ni dépensé, ni perdu.',
  }
  return (isCredit ? credit : debit)[type]
}

export const ALL = 'all'

export function matchesCashflowType(tx: BankTransactionItem, filter: string): boolean {
  return filter === ALL || tx.cashflow_type === filter
}

export function matchesOperationType(tx: BankTransactionItem, filter: string): boolean {
  return filter === ALL || tx.operation_type === filter
}

/** A pair offered to the user, or a label only the user can type. */
export function needsReview(tx: BankTransactionItem): boolean {
  return tx.transfer_status === 'suggested' || tx.flow_question !== null
}
