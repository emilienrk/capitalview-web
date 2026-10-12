import { describe, expect, it } from 'vitest'

import type { BankHistoryItem } from '@/types'
import { historyTitle } from '@/utils/bankHistory'

function item(fields: Partial<BankHistoryItem>): BankHistoryItem {
  return {
    kind: 'type', id: 'x', at: null, type: null, operations: [], name: null, confirmed: null,
    overridden_by_pair: false, ...fields,
  }
}

describe('historyTitle', () => {
  it('says a pair the way the buttons did', () => {
    expect(historyTitle(item({ kind: 'transfer' }))).toBe("Ensemble : liées l'une à l'autre")
    expect(historyTitle(item({ kind: 'not_transfer' }))).toBe('Pas ensemble : chacune comptée de son côté')
  })

  it('names the investment account an operation was bound to, or ruled out of', () => {
    expect(historyTitle(item({ kind: 'contribution', name: 'PEA' }))).toBe('Liée à un mouvement de PEA : comptée en Investissement')
    expect(historyTitle(item({ kind: 'not_contribution', name: null }))).toBe("Pas liée à un mouvement d'un compte d'investissement")
  })

  it('names the type an operation was given', () => {
    expect(historyTitle(item({ kind: 'type', type: 'SAVING' }))).toBe('Comptée en Épargne')
    expect(historyTitle(item({ kind: 'type', type: 'NEUTRAL' }))).toBe('Non comptée')
  })

  it('tells a confirmed recurring payment from a refused one', () => {
    expect(historyTitle(item({ kind: 'recurring', confirmed: true, name: 'Netflix' }))).toBe('Récurrent confirmé : Netflix')
    expect(historyTitle(item({ kind: 'recurring', confirmed: false, name: 'Netflix' }))).toBe('Pas un récurrent : Netflix')
  })
})
