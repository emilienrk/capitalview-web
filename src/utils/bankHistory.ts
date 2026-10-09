import type { BankHistoryItem, CashflowType } from '@/types'
import { CASHFLOW_TYPE_LABELS } from '@/utils/cashflowTypes'

/** "comptée en Épargne", or "non comptée": a type read as what it does. */
function counted(type: CashflowType | null, ending: '' | 'e'): string {
  if (type === 'NEUTRAL') return `non compté${ending}`
  return `compté${ending} en ${type ? CASHFLOW_TYPE_LABELS[type] : '?'}`
}

/** What one answer said, in the words of the question it settled. */
export function historyTitle(item: BankHistoryItem): string {
  switch (item.kind) {
    case 'transfer':
      return 'Ensemble : un virement entre vos comptes'
    case 'not_transfer':
      return 'Pas ensemble : chacune comptée de son côté'
    case 'reversal':
      return 'Liée à son remboursement'
    case 'type': {
      const words = counted(item.type, 'e')
      return words.charAt(0).toUpperCase() + words.slice(1)
    }
    case 'rule': {
      const count = item.operation_count ?? 0
      return `« ${item.name} » ${counted(item.type, '')}, et les prochaines (${count} opération${count > 1 ? 's' : ''})`
    }
    case 'recurring':
      return `${item.confirmed ? 'Récurrent confirmé' : 'Pas un récurrent'} : ${item.name}`
  }
}
