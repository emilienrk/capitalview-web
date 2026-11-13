import { describe, expect, it } from 'vitest'

import type { BankSyncNotice } from '@/types'
import { syncNoticeSentences } from '@/utils/syncNotice'

const format = {
  count: (n: number) => String(n),
  date: (iso: string) => iso.split('-').reverse().join('/'),
  amount: (value: string | number) => `${Number(value).toFixed(2)} €`,
}

function aNotice(overrides: Partial<BankSyncNotice> = {}): BankSyncNotice {
  return {
    replaced: 1207, replaced_from: '2022-05-14', answers_dropped: 0, kept: 0,
    operations_total: null, bank_balance: null, curve_shift: null,
    ...overrides,
  }
}

describe('syncNoticeSentences', () => {
  it('says the whole history moved only when no imported operation was kept', () => {
    const { replaced, shift } = syncNoticeSentences(
      aNotice({ answers_dropped: 30, operations_total: '1240', bank_balance: '1440', curve_shift: '200' }), format,
    )

    expect(replaced).toBe(
      '1207 opérations importées remplacées par celles de votre banque à partir du 14/05/2022 : '
      + '30 réponses sont à redonner dans À trier.',
    )
    expect(shift).toBe(
      'Vos opérations importées donnent 1240.00 €, votre banque 1440.00 € : la courbe a été relevée de 200.00 €. '
      + "Votre import ne remonte sans doute pas à l'ouverture du compte, ou il lui manque des opérations.",
    )
  })

  it('says the curve only moved from the bank\'s first day, as a step, when older imported operations stay', () => {
    const { replaced, shift } = syncNoticeSentences(
      aNotice({ kept: 340, operations_total: '1440', bank_balance: '1240', curve_shift: '-200' }), format,
    )

    expect(replaced).toBe(
      '1207 opérations importées remplacées par celles de votre banque à partir du 14/05/2022. '
      + "Les 340 opérations d'avant restent celles de votre import : votre banque ne remonte pas plus loin.",
    )
    expect(shift).toBe(
      'Vos opérations donnent 1440.00 €, votre banque 1240.00 € : la courbe a été abaissée de 200.00 € '
      + "à partir du 14/05/2022. Avant cette date, elle reste celle de votre import, d'où une marche ce jour-là.",
    )
  })

  it('writes one kept operation and one dropped answer in the singular', () => {
    const { replaced } = syncNoticeSentences(aNotice({ replaced: 1, answers_dropped: 1, kept: 1 }), format)

    expect(replaced).toBe(
      '1 opération importée remplacée par celles de votre banque à partir du 14/05/2022 : 1 réponse est à redonner '
      + "dans À trier. L'opération d'avant reste celle de votre import : votre banque ne remonte pas plus loin.",
    )
  })
})
