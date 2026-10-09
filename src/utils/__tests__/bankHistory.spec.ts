import { describe, expect, it } from 'vitest'

import type { BankHistoryItem } from '@/types'
import { historyTitle } from '@/utils/bankHistory'

function item(fields: Partial<BankHistoryItem>): BankHistoryItem {
  return {
    kind: 'type', id: 'x', at: null, type: null, operations: [], name: null, account_name: null,
    operation_count: null, confirmed: null, overridden_by_pair: false, ...fields,
  }
}

describe('historyTitle', () => {
  it('says a refused pair the way the button did', () => {
    expect(historyTitle(item({ kind: 'not_transfer' }))).toBe('Pas ensemble : chacune comptée de son côté')
  })

  it('names the type an operation was given', () => {
    expect(historyTitle(item({ kind: 'type', type: 'SAVING' }))).toBe('Comptée en Épargne')
    expect(historyTitle(item({ kind: 'type', type: 'NEUTRAL' }))).toBe('Non comptée')
  })

  it('says a rule reaches the operations to come, and counts those it types', () => {
    expect(historyTitle(item({ kind: 'rule', type: 'NEUTRAL', name: 'VIR INST JEAN TIERS', operation_count: 3 })))
      .toBe('« VIR INST JEAN TIERS » non compté, et les prochaines (3 opérations)')
  })

  it('tells a confirmed recurring payment from a refused one', () => {
    expect(historyTitle(item({ kind: 'recurring', confirmed: true, name: 'Netflix' }))).toBe('Récurrent confirmé : Netflix')
    expect(historyTitle(item({ kind: 'recurring', confirmed: false, name: 'Netflix' }))).toBe('Pas un récurrent : Netflix')
  })
})
