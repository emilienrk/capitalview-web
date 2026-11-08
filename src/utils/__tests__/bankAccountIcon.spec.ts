import { describe, expect, it } from 'vitest'
import { Landmark, PiggyBank, Wallet } from 'lucide-vue-next'

import { bankAccountIcon } from '@/utils/bankAccountIcon'

const accounts = [
  { id: 'acc-1', name: 'Compte principal', account_type: 'CHECKING' as const },
  { id: 'acc-2', name: 'Livret A', account_type: 'LIVRET_A' as const },
  { id: 'acc-3', name: 'Compte plaisir', account_type: 'LIVRET_DEVE' as const },
  { id: 'acc-4', name: 'Joint', account_type: 'CHECKING' as const },
  { id: 'acc-5', name: 'Joint', account_type: 'SAVINGS' as const },
]

describe('bankAccountIcon', () => {
  it('marks a current account as a wallet and any savings account as a piggy bank', () => {
    expect(bankAccountIcon(accounts, { id: 'acc-1' })).toBe(Wallet)
    expect(bankAccountIcon(accounts, { id: 'acc-2' })).toBe(PiggyBank)
    expect(bankAccountIcon(accounts, { name: 'Compte plaisir' })).toBe(PiggyBank)
  })

  it('stays neutral when the account cannot be told for sure', () => {
    expect(bankAccountIcon(accounts, { name: 'Joint' })).toBe(Landmark)
    expect(bankAccountIcon(accounts, { name: 'Inconnu' })).toBe(Landmark)
    expect(bankAccountIcon([], { id: 'acc-1', name: 'Compte principal' })).toBe(Landmark)
  })

  it('prefers the id over a name two accounts share', () => {
    expect(bankAccountIcon(accounts, { id: 'acc-5', name: 'Joint' })).toBe(PiggyBank)
  })
})
