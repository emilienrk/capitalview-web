import type {
  BankRecurringItem, BankRecurringQuestion, RecurringCadence, RecurringDirection, RecurringNature, RecurringRole,
} from '@/types'

/** As an adjective: « Paiement mensuel », « Revenu mensuel ». */
export const CADENCE_LABELS: Record<RecurringCadence, string> = {
  weekly: 'hebdomadaire',
  biweekly: 'toutes les 2 semaines',
  fourweekly: 'toutes les 4 semaines',
  monthly: 'mensuel',
  bimonthly: 'bimestriel',
  quarterly: 'trimestriel',
  semiannual: 'semestriel',
  annual: 'annuel',
}

/** After an amount: « 21,60 € / mois ». */
export const CADENCE_PER: Record<RecurringCadence, string> = {
  weekly: '/ semaine',
  biweekly: '/ 2 semaines',
  fourweekly: '/ 4 semaines',
  monthly: '/ mois',
  bimonthly: '/ 2 mois',
  quarterly: '/ trimestre',
  semiannual: '/ semestre',
  annual: '/ an',
}

/**
 * The natures the picker offers for each direction, roof first, salary first:
 * the API refuses a salary on a payment and a phone plan on an income.
 */
export const NATURES: Record<RecurringDirection, readonly RecurringNature[]> = {
  expense: ['housing', 'energy', 'insurance', 'credit', 'telecom', 'transport', 'sport', 'leisure', 'software', 'other'],
  income: ['salary', 'allowance', 'pension', 'rental', 'support', 'interest', 'other'],
}

export const NATURE_LABELS: Record<RecurringNature, string> = {
  housing: 'Logement',
  energy: 'Énergie',
  insurance: 'Assurance',
  credit: 'Crédit',
  telecom: 'Télécom',
  transport: 'Transport',
  sport: 'Sport',
  leisure: 'Loisirs',
  software: 'Logiciels',
  salary: 'Salaire',
  allowance: 'Aides et allocations',
  pension: 'Pension, retraite',
  rental: 'Loyers perçus',
  support: "Aide d'un proche",
  interest: 'Intérêts',
  other: 'Autre',
}

/**
 * What every payment of one nature took each year, newest year first: the rent
 * of a life, whoever the landlord was then. Ended ones count — that is the point.
 * Heaviest nature first, the unfiled ones last, as the tab lists them.
 */
export function historyByNature(items: BankRecurringItem[]): Array<{
  nature: RecurringNature | null
  total: number
  years: Array<{ year: number; amount: number }>
}> {
  const natures = new Map<RecurringNature | null, Map<number, number>>()
  for (const item of items) {
    const years = natures.get(item.nature) ?? new Map<number, number>()
    for (const paid of item.paid_by_year) {
      years.set(paid.year, (years.get(paid.year) ?? 0) + Number(paid.amount))
    }
    if (years.size) natures.set(item.nature, years)
  }
  return [...natures]
    .map(([nature, years]) => ({
      nature,
      total: [...years.values()].reduce((sum, amount) => sum + amount, 0),
      years: [...years].map(([year, amount]) => ({ year, amount })).sort((a, b) => b.year - a.year),
    }))
    .sort((a, b) => (a.nature === null ? 1 : b.nature === null ? -1 : b.total - a.total))
}

/**
 * What an operation's badge adds when it is not a plain due date. A refund on
 * an income is a debit taking part of it back, not money coming in.
 */
export function roleNote(role: RecurringRole, direction: RecurringDirection): string | null {
  const notes: Record<RecurringRole, string | null> = {
    regular: null,
    extra: 'hors échéance',
    cancelled: 'annulée',
    refund: direction === 'income' ? 'reprise' : 'remboursement',
    manual: null,
  }
  return notes[role]
}

/** « Paiement mensuel · 21,60 € depuis juillet 2025 ? » — `amount` comes formatted. */
export function questionText(question: BankRecurringQuestion, amount: string): string {
  const [year, month] = question.since.split('-').map(Number)
  const since = new Date(year!, month! - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  const approx = question.variable ? '≈ ' : ''
  const kind = question.direction === 'income' ? 'Revenu' : 'Paiement'
  return `${kind} ${CADENCE_LABELS[question.cadence]} · ${approx}${amount} depuis ${since} ?`
}

/** Counted in the expenses, or the income: found sure enough, or said yes to. */
export function isCounted(item: BankRecurringItem): boolean {
  return item.state === 'auto' || item.state === 'confirmed'
}

/** Counted and not over: what the list shows first, late ones included. */
export function isCurrent(item: BankRecurringItem): boolean {
  return isCounted(item) && item.status !== 'ended'
}

/** What the monthly and yearly totals add up — a late one may be over already. */
export function isInTotal(item: BankRecurringItem): boolean {
  return isCounted(item) && (item.status === 'active' || item.status === 'stale')
}
