import { describe, expect, it } from 'vitest'

import {
  ALL, RECURRING, answerHint, answerLabel, contributionBadge, contributionGap, contributionMessage, contributionNote, keptByHand,
  matchesCashflowType,
  needsReview, ownAnswer, ruleTitle, togetherNote, typeSourceTitle,
} from '@/utils/cashflowTypes'
import type { BankTransactionItem } from '@/types'

function anOperation(overrides: Partial<BankTransactionItem> = {}): BankTransactionItem {
  return {
    id: 'tx-1', account_id: 'acc-1', account_name: 'Compte courant', operation_date: '2026-03-05',
    amount: 40, currency: 'EUR', is_credit: false, is_pending: false, label: 'VIR INST ROUKINE EMILIEN',
    transfer_account_id: null, transfer_account_name: null, transfer_id: null, transfer_status: null,
    cashflow_type: 'EXPENSE', type_source: 'default', type_rule_id: null,
    flow_question: null, contribution: null, asks_contribution: false, recurring: null, recurring_question: null,
    ...overrides,
  }
}

describe('answerLabel', () => {
  it('reads a credit answer as what it means for money coming in', () => {
    expect(answerLabel('EXPENSE', true)).toBe('Remboursement')
    expect(answerLabel('SAVING', true)).toBe("Reprise d'épargne")
    expect(answerLabel('INVESTMENT', true)).toBe("Reprise d'investissement")
  })

  it('reads a debit answer as the type itself', () => {
    expect(answerLabel('EXPENSE', false)).toBe('Dépense')
    expect(answerLabel('SAVING', false)).toBe('Épargne')
  })
})

describe('filters', () => {
  it('keeps every operation until a type is picked', () => {
    expect(matchesCashflowType(anOperation(), ALL)).toBe(true)
    expect(matchesCashflowType(anOperation(), 'SAVING')).toBe(false)
    expect(matchesCashflowType(anOperation({ cashflow_type: 'SAVING' }), 'SAVING')).toBe(true)
  })

  it('keeps only the operations of a recurring payment or income under Récurrent, whatever their type', () => {
    const tag = {
      id: null, key: 'k', direction: 'expense', name: 'EDF', cadence: 'monthly', role: 'regular', state: 'confirmed',
    } as const
    const salary = anOperation({
      is_credit: true, cashflow_type: 'INCOME', recurring: { ...tag, direction: 'income', name: 'Employeur' },
    })
    expect(matchesCashflowType(anOperation(), RECURRING)).toBe(false)
    expect(matchesCashflowType(anOperation({ recurring: tag }), RECURRING)).toBe(true)
    expect(matchesCashflowType(salary, RECURRING)).toBe(true)
    // Still an income under its type: the mark does not move it.
    expect(matchesCashflowType(salary, 'INCOME')).toBe(true)
    expect(matchesCashflowType(salary, 'EXPENSE')).toBe(false)
  })
})

describe('needsReview', () => {
  it('holds a suggested pair, a flow question and a recurring question, nothing else', () => {
    const question = {
      direction: 'expense', cadence: 'monthly', amount: 21.6, variable: false, occurrence_count: 4, since: '2026-06-02',
      annual_estimate: 259.2, renamed_from: [],
    } as const
    expect(needsReview(anOperation())).toBe(false)
    expect(needsReview(anOperation({ transfer_status: 'suggested' }))).toBe(true)
    expect(needsReview(anOperation({ flow_question: { choices: ['EXPENSE'], operation_count: 3 } }))).toBe(true)
    expect(needsReview(anOperation({ transfer_status: 'recurring' }))).toBe(false)
    expect(needsReview(anOperation({ recurring_question: question }))).toBe(true)
    expect(needsReview(anOperation({
      is_credit: true, cashflow_type: 'INCOME', recurring_question: { ...question, direction: 'income' },
    }))).toBe(true)
  })
})

describe('answerHint', () => {
  it('says what the answer does to the figures, on both sides', () => {
    expect(answerHint('EXPENSE', true)).toContain('Déduit des dépenses')
    expect(answerHint('EXPENSE', false)).toContain('Compté dans vos dépenses')
    expect(answerHint('SAVING', true)).toContain('Repris')
    expect(answerHint('SAVING', false)).toBe('Compté dans votre épargne.')
    expect(answerHint('NEUTRAL', true)).toBe(answerHint('NEUTRAL', false))
  })
})

describe('contributionNote', () => {
  const deposit = { id: 'deposit-1', account_name: 'PEA', day: '2026-03-07', amount: 200, is_deposit: true, exact: false }
  const euros = (value: number) => `${value.toFixed(2).replace('.', ',')} €`

  it('says nothing of a vouched deposit of the very amount on the very day: the badge does', () => {
    expect(contributionNote({ ...deposit, exact: true }, 200, euros, '5 mars', true)).toBeNull()
    expect(contributionBadge({ ...deposit, exact: true })).toBe('vers PEA')
  })

  it('names the fee a platform kept', () => {
    expect(contributionNote({ ...deposit, amount: 199, exact: true }, 200, euros, '5 mars', true)).toBe(
      '199,00 € arrivés sur PEA, 1,00 € de frais.',
    )
  })

  it('asks about a nearby deposit without deciding for the user', () => {
    expect(contributionNote(deposit, 200, euros, '7 mars', false)).toBe(
      'Versement de 200,00 € sur PEA le 7 mars ?',
    )
  })

  it('asks about a same-day deposit until the user vouches for it', () => {
    expect(contributionNote({ ...deposit, exact: true }, 200, euros, '5 mars', false)).toBe(
      'Versement de 200,00 € sur PEA le même jour ?',
    )
  })

  it('reads a withdrawal as money coming back', () => {
    const withdrawal = { ...deposit, is_deposit: false }
    expect(contributionNote(withdrawal, 80, euros, '5 mars', false)).toBe('Retrait de 200,00 € depuis PEA le 5 mars ?')
    expect(contributionBadge({ ...withdrawal, exact: true })).toBe('depuis PEA')
  })
})

describe('contributionGap', () => {
  const deposit = { id: 'deposit-1', account_name: 'PEA', day: '2026-03-07', amount: 200, is_deposit: true, exact: true }
  const euros = (value: number) => `${value.toFixed(2).replace('.', ',')} €`

  it('leaves the badge alone when the amount and the day match', () => {
    expect(contributionGap(deposit, 200, euros, '7 mars', false)).toBeNull()
    expect(contributionGap(deposit, 200, euros, '7 mars', true)).toBeNull()
  })

  it('says the amount that arrived and the gap, a fee once vouched for', () => {
    expect(contributionGap({ ...deposit, amount: 99 }, 100, euros, '7 mars', false)).toBe('Versement de 99,00 €, 1,00 € d\'écart')
    expect(contributionGap({ ...deposit, amount: 199 }, 200, euros, '7 mars', true)).toBe('Versement de 199,00 €, 1,00 € de frais')
  })

  it('says the day when it is another one', () => {
    expect(contributionGap({ ...deposit, exact: false }, 200, euros, '7 mars', false)).toBe('Versement du 7 mars')
    expect(contributionGap({ ...deposit, exact: false, is_deposit: false, amount: 11 }, 12, euros, '7 mars', false)).toBe(
      'Retrait de 11,00 € le 7 mars, 1,00 € d\'écart',
    )
  })
})

describe('ownAnswer', () => {
  const contribution = { id: 'deposit-1', account_name: 'PEA', day: '2026-03-05', amount: 40, is_deposit: true, exact: true }

  it('answers for the operation with the movement facing it, as the API asks', () => {
    expect(ownAnswer(anOperation({ contribution }))).toEqual([{ transaction_id: 'tx-1', contribution_id: 'deposit-1' }])
    expect(ownAnswer(anOperation())).toEqual([])
    expect(needsReview(anOperation({ contribution, asks_contribution: true }))).toBe(true)
    expect(needsReview(anOperation({ contribution }))).toBe(false)
  })
})

describe('togetherNote', () => {
  it('says what the pair counts as, never whether it is a transfer or a refund', () => {
    expect(togetherNote('NEUTRAL')).toBe("Ensemble : elles s'annulent, aucune n'est comptée.")
    expect(togetherNote(null)).toBe("Ensemble : elles s'annulent, aucune n'est comptée.")
    expect(togetherNote('SAVING')).toBe('Ensemble : comptées en épargne.')
  })
})

describe('typeSourceTitle', () => {
  it('separates what was detected, deduced and chosen', () => {
    expect(typeSourceTitle('default')).toContain('détecté')
    expect(typeSourceTitle('contribution')).toContain('déduit')
    expect(typeSourceTitle('override')).toContain('choisi')
    expect(typeSourceTitle('rule')).toContain('choisi')
  })
})

describe('ruleTitle', () => {
  it('reads a rule given from an answer by its label, one written by hand by its text', () => {
    expect(ruleTitle({ match: 'similar', signature: 'spotify', label: 'PRLV SEPA Spotify' })).toBe('PRLV SEPA Spotify')
    expect(ruleTitle({ match: 'similar', signature: 'spotify', label: null })).toBe('spotify')
    expect(ruleTitle({ match: 'contains', signature: 'spotify', label: 'PRLV SEPA Spotify' })).toBe('Contient « spotify »')
    expect(ruleTitle({ match: 'starts_with', signature: 'carte', label: null })).toBe('Commence par « carte »')
  })
})

describe('contributionMessage', () => {
  it('says a No keeps the type the user gave by hand', () => {
    expect(contributionMessage('not_contribution', 'NEUTRAL')).toBe('Reste en Non compté.')
  })

  it('reads a No on an operation never typed as any other operation', () => {
    expect(contributionMessage('not_contribution', null)).toBe('Comptée comme les autres opérations.')
  })

  it('counts a Yes as an investment, whatever the type given before', () => {
    expect(contributionMessage('contribution', 'NEUTRAL')).toContain('Comptée en Investissement')
  })
})

describe('keptByHand', () => {
  const typed = anOperation({ id: 'tx-2', type_source: 'override', cashflow_type: 'SAVING' })

  it('finds the type given by hand on the one operation answered, shown or ticked in the list', () => {
    expect(keptByHand(typed, ['tx-2'], [])).toBe('SAVING')
    expect(keptByHand(anOperation(), ['tx-2'], [typed])).toBe('SAVING')
  })

  it('keeps nothing for several answers, or for an operation never typed', () => {
    expect(keptByHand(typed, ['tx-2', 'tx-1'], [typed])).toBeNull()
    expect(keptByHand(anOperation(), ['tx-1'], [])).toBeNull()
  })
})
