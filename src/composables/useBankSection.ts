import { inject, type InjectionKey } from 'vue'
import type { BankAccountResponse, BankTransactionItem } from '@/types'

/** What the Banque section's shell offers the tabs rendered inside it. */
export interface BankSection {
  openCreateAccount: () => void
  openEditAccount: (account: BankAccountResponse) => void
  /** An operation or a balance typed on an account no bank feeds, or a typed one to correct. */
  openEntry: (accountId: string, editing?: BankTransactionItem | null) => void
}

export const BANK_SECTION_KEY: InjectionKey<BankSection> = Symbol('bank-section')

export function useBankSection(): BankSection {
  const section = inject(BANK_SECTION_KEY)
  if (!section) throw new Error('useBankSection() must be used inside the Banque section')
  return section
}
