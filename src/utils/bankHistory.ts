import type { BankHistoryItem, CashflowType } from '@/types'
import { CASHFLOW_TYPE_LABELS } from '@/utils/cashflowTypes'

/** "comptée en Épargne", or "non comptée": a type read as what it does. */
function counted(type: CashflowType | null, ending: '' | 'e'): string {
  if (type === 'NEUTRAL') return `non compté${ending}`
  return `compté${ending} en ${type ? CASHFLOW_TYPE_LABELS[type] : '?'}`
}

/** The declared deposit or withdrawal a decision named, by its account while it is still there. */
function movement(account: string | null): string {
  return account ? `un mouvement de ${account}` : "un mouvement d'un compte d'investissement"
}

/** What one answer said, in the words of the question it settled. */
export function historyTitle(item: BankHistoryItem): string {
  switch (item.kind) {
    case 'transfer':
      return "Ensemble : liées l'une à l'autre"
    case 'not_transfer':
      return 'Pas ensemble : chacune comptée de son côté'
    case 'reversal':
      return 'Liée à son remboursement'
    case 'contribution':
      return `Liée à ${movement(item.name)} : comptée en Investissement`
    case 'not_contribution':
      return `Pas liée à ${movement(item.name)}`
    case 'type': {
      const words = counted(item.type, 'e')
      return words.charAt(0).toUpperCase() + words.slice(1)
    }
    case 'recurring':
      return `${item.confirmed ? 'Récurrent confirmé' : 'Pas un récurrent'} : ${item.name}`
  }
}
