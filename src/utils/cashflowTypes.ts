import type { BankContributionMatch, BankTransactionItem, CashflowType, OperationType, TypeSource } from '@/types'

export const CASHFLOW_TYPES: CashflowType[] = ['INCOME', 'EXPENSE', 'SAVING', 'INVESTMENT', 'NEUTRAL']

export const CASHFLOW_TYPE_LABELS: Record<CashflowType, string> = {
  INCOME: 'Entrée',
  EXPENSE: 'Dépense',
  SAVING: 'Épargne',
  INVESTMENT: 'Investissement',
  NEUTRAL: 'Non compté',
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
    NEUTRAL: 'Non compté',
  }
  return credit[type]
}

/**
 * What an answer does to the figures, shown on hover rather than written out:
 * "Remboursement" is the one nobody guesses, and it is the answer most
 * received transfers deserve.
 */
export function answerHint(type: CashflowType, isCredit: boolean): string {
  // Said on both sides, because the doubt is the same: an object of yours sold
  // is not a revenue, it is something you owned turned into cash.
  if (type === 'NEUTRAL') {
    return "Compté nulle part : de l'argent qui n'a fait que passer, ou un objet à vous revendu."
  }
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

/** Why an operation carries its type, said where the type is shown. */
export function typeSourceTitle(source: TypeSource): string {
  if (source === 'default') return 'Type détecté : le changer'
  if (source === 'contribution') return "Type déduit d'un versement sur un de vos comptes d'investissement : le changer"
  if (source === 'recurring') return 'Type donné par son récurrent : le changer'
  return 'Type choisi : le changer'
}

/**
 * What an investment account says about an operation, in one line. The amount
 * and the day come formatted, so privacy mode and the locale apply where they
 * are displayed.
 */
export function contributionNote(match: BankContributionMatch, amount: string, day: string): string {
  const movement = match.is_deposit
    ? `versement de ${amount} sur ${match.account_name}`
    : `retrait de ${amount} depuis ${match.account_name}`
  return match.exact
    ? `Reconnu : ${movement}, le même jour.`
    : `Un ${movement} le ${day} pourrait correspondre.`
}

/**
 * What settling a suggested pair does to the figures, said on hover as
 * `answerHint` says it for a type. In full, because both answers teach the
 * pairing something durable about the two labels, not just about this pair.
 */
export const PAIR_HINTS = {
  transfer:
    "C'est un virement entre mes comptes : les deux lignes sortent des totaux, et les prochaines paires qui leur ressemblent s'apparieront seules.",
  notTransfer:
    "Ce n'est pas un virement : chaque ligne compte de son côté, et cette paire ne sera plus proposée.",
  unlink:
    'Dissocier : les deux opérations recomptent chacune de leur côté, dans les entrées et les dépenses.',
  link:
    "Lier à un virement entre vos comptes, ou au remboursement de cette opération : les deux sortent alors des totaux.",
} as const

export const ALL = 'all'
/**
 * Offered beside the types: a mark on expenses and income, not a type of its
 * own. Payments and income both, the direction filter tells them apart.
 */
export const RECURRING = 'recurring'

export function matchesCashflowType(tx: BankTransactionItem, filter: string): boolean {
  if (filter === RECURRING) return tx.recurring !== null
  return filter === ALL || tx.cashflow_type === filter
}

export function matchesOperationType(tx: BankTransactionItem, filter: string): boolean {
  return filter === ALL || tx.operation_type === filter
}

/** A pair offered to the user, a label only the user can type, or a recurring payment or income to confirm. */
export function needsReview(tx: BankTransactionItem): boolean {
  return tx.transfer_status === 'suggested' || tx.flow_question !== null || tx.recurring_question !== null
}
