import { describe, expect, it } from 'vitest'

import { hasWords, labelSuggestions } from '@/utils/entryLabels'
import type { BankLedger, BankLedgerRow } from '@/types'

describe('hasWords', () => {
  it('reads words as the API does: two letters or more, no digit', () => {
    expect(hasWords('Virement vers Livret A')).toBe(true)
    expect(hasWords('A.r.e.a.')).toBe(false)
    expect(hasWords('H&L')).toBe(false)
    expect(hasWords('00160669')).toBe(false)
    expect(hasWords('Cgf17516mcdo1')).toBe(false)
    expect(hasWords('   ')).toBe(false)
  })
})

describe('labelSuggestions', () => {
  function row(account: number, label: string | null, isCredit: boolean, day: string): BankLedgerRow {
    return { id: `${account}-${label}-${day}`, account, label, is_credit: isCredit, day } as BankLedgerRow
  }
  const ledger = {
    accounts: [{ id: 'livret' }, { id: 'courant' }],
    rows: [
      row(0, 'VIR Virement depuis Compte courant', true, '2026-01-02'),
      row(0, 'VIR Virement depuis Compte courant', true, '2026-02-02'),
      row(0, 'INTERETS', true, '2026-01-01'),
      row(0, 'VIR Virement depuis Compte epargne', false, '2026-03-02'),
      row(0, '00160669', true, '2026-03-03'),
      row(1, 'Salaire', true, '2026-03-01'),
    ],
  } as unknown as BankLedger

  it('offers the labels of this account and direction, the most used first', () => {
    expect(labelSuggestions(ledger, 'livret', true)).toEqual(['VIR Virement depuis Compte courant', 'INTERETS'])
    expect(labelSuggestions(ledger, 'livret', false)).toEqual(['VIR Virement depuis Compte epargne'])
  })

  it('offers nothing for an account the ledger does not hold', () => {
    expect(labelSuggestions(ledger, 'autre', true)).toEqual([])
    expect(labelSuggestions(null, 'livret', true)).toEqual([])
  })
})
