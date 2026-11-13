import type { BankSyncNotice } from '@/types'

/** How the card renders a count, a date and an amount; amounts come back masked in privacy mode. */
export interface NoticeFormat {
  count: (n: number) => string
  date: (iso: string) => string
  amount: (value: string | number) => string
}

const s = (n: number) => (n > 1 ? 's' : '')

/**
 * The sentences of what the first sync over imported operations did (API
 * docs/bank-ledger.md, L1 and L11). When imported rows older than the bank's
 * history stay, only the days from `replaced_from` moved: the curve keeps the
 * import's before it, so the shift is said as a step on that day.
 */
export function syncNoticeSentences(
  notice: BankSyncNotice,
  format: NoticeFormat,
): { replaced: string | null; shift: string | null } {
  const from = notice.replaced_from ? format.date(notice.replaced_from) : null
  const kept = notice.kept > 0

  let replaced: string | null = null
  if (notice.replaced > 0 && from) {
    const n = notice.replaced
    replaced = `${format.count(n)} opération${s(n)} importée${s(n)} remplacée${s(n)} par celles de votre banque à partir du ${from}`
    replaced += notice.answers_dropped > 0
      ? ` : ${format.count(notice.answers_dropped)} réponse${s(notice.answers_dropped)} `
        + `${notice.answers_dropped > 1 ? 'sont' : 'est'} à redonner dans À trier.`
      : '.'
    if (kept) {
      replaced += notice.kept > 1
        ? ` Les ${format.count(notice.kept)} opérations d'avant restent celles de votre import`
        : " L'opération d'avant reste celle de votre import"
      replaced += ' : votre banque ne remonte pas plus loin.'
    }
  }

  let shift: string | null = null
  if (notice.curve_shift !== null && notice.operations_total !== null && notice.bank_balance !== null) {
    const direction = Number(notice.curve_shift) > 0 ? 'relevée' : 'abaissée'
    const by = format.amount(Math.abs(Number(notice.curve_shift)))
    shift = kept && from
      ? `Vos opérations donnent ${format.amount(notice.operations_total)}, votre banque ${format.amount(notice.bank_balance)} : `
        + `la courbe a été ${direction} de ${by} à partir du ${from}. `
        + "Avant cette date, elle reste celle de votre import, d'où une marche ce jour-là."
      : `Vos opérations importées donnent ${format.amount(notice.operations_total)}, votre banque ${format.amount(notice.bank_balance)} : `
        + `la courbe a été ${direction} de ${by}. `
        + "Votre import ne remonte sans doute pas à l'ouverture du compte, ou il lui manque des opérations."
  }
  return { replaced, shift }
}
