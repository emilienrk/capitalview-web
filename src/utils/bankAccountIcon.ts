import type { Component } from 'vue'
import { Landmark, PiggyBank, TrendingUp, Wallet } from 'lucide-vue-next'

import type { BankAccountResponse } from '@/types'

/** A deposit or withdrawal declared on a Bourse, Crypto or placement account. */
export const INVESTMENT_ACCOUNT_ICON: Component = TrendingUp

/**
 * A bank account marked by what it is — current account or savings — never by
 * what the operation looks like: without a dictionary, a card payment and a
 * transfer cannot be told apart (docs/bank-sorting.md, R34). Known by its id,
 * or by its name when one account alone bears it; otherwise a neutral bank.
 */
export function bankAccountIcon(
  accounts: Pick<BankAccountResponse, 'id' | 'name' | 'account_type'>[],
  account: { id?: string | null; name?: string | null },
): Component {
  const byId = account.id ? accounts.filter((candidate) => candidate.id === account.id) : []
  const found = byId.length ? byId : accounts.filter((candidate) => account.name && candidate.name === account.name)
  if (found.length !== 1) return Landmark
  return found[0]!.account_type === 'CHECKING' ? Wallet : PiggyBank
}
