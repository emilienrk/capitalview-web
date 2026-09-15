import type {
  BankCategoryAssign,
  BankTransactionItem,
  CategoryNature,
  OperationNature,
  OperationType,
} from '@/types'

export const OPERATION_TYPE_LABELS: Record<OperationType, string> = {
  CARD: 'Carte',
  TRANSFER: 'Virement',
  DIRECT_DEBIT: 'Prélèvement',
  WITHDRAWAL: 'Retrait',
  INTEREST: 'Intérêts',
  UNKNOWN: 'Type inconnu',
}

export const CATEGORY_NATURE_LABELS: Record<CategoryNature, string> = {
  EXPENSE: 'Dépense',
  INCOME: 'Revenu',
  SAVING: 'Épargne',
  INVESTMENT: 'Investissement',
}

export const OPERATION_NATURE_LABELS: Record<OperationNature, string> = {
  ...CATEGORY_NATURE_LABELS,
  INTERNAL: 'Interne',
  NEUTRALIZED: 'Neutralisée',
}

export const CATEGORY_NATURE_OPTIONS = (Object.keys(CATEGORY_NATURE_LABELS) as CategoryNature[]).map((value) => ({
  label: CATEGORY_NATURE_LABELS[value],
  value,
}))

/** The category filter's two fixed values; any other is a category id. */
export const ALL_CATEGORIES = 'all'
export const UNCATEGORIZED = 'uncategorized'

/**
 * Nothing files it and it is not paired: what the "À ranger" queue holds. A
 * paired transfer counts by its pair whatever its category, so it is never
 * waiting for one.
 */
export function isUncategorized(tx: BankTransactionItem): boolean {
  const paired = tx.transfer_status !== null && tx.transfer_status !== 'suggested'
  return tx.category_source === null && !paired
}

export function matchesCategory(tx: BankTransactionItem, filter: string): boolean {
  if (filter === ALL_CATEGORIES) return true
  if (filter === UNCATEGORIZED) return isUncategorized(tx)
  return tx.category_id === filter
}

export function matchesOperationType(tx: BankTransactionItem, filter: string): boolean {
  return filter === ALL_CATEGORIES || tx.operation_type === filter
}

/**
 * The body of PUT /banking/transactions/{id}/category. "No category" is only
 * ever about one operation: no rule files operations into nothing.
 */
export function categoryAssignment(
  categoryId: string | null,
  applyToSimilar: boolean,
  tokens: string[],
): BankCategoryAssign {
  if (categoryId === null || !applyToSimilar) {
    return { category_id: categoryId, apply_to_similar: false }
  }
  return { category_id: categoryId, apply_to_similar: true, tokens }
}
