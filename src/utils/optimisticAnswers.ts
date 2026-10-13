/**
 * What an answer in À trier or Opérations changes on screen, known before the
 * API confirms it: the screen moves at the click, and the reload that follows
 * the answer brings the server's own reading.
 *
 * Only what the answer settles for certain is foreseen. Which operation
 * carries a label's question next, a question a "Non" or a "Pas ensemble"
 * may raise, the pairs an "Ensemble" teaches: all of that waits for the reload.
 */
import type {
  BankContributionDecisionKind, BankReviewQueue, BankTransactionItem, BankTransactionsResponse,
  BankTransferDecisionKind, BankTransferQuestionsResponse, CashflowType, TypeScope,
} from '@/types'

export interface AnswerEffect {
  /** What each operation the answer reads anew now shows. */
  operations: Record<string, Partial<BankTransactionItem>>
  /** The questions it closes: by the operations carrying them (a pair: its debit, then its credit), and their day. */
  settled: Array<{ ids: string[]; day: string | null }>
  /** The questions left open with fewer operations, by the operation carrying them: what goes. */
  shrunk: Record<string, { count: number; amount: number }>
  /** Of those, the ones leaving the month shown with the operation that carried them. */
  movedOut?: string[]
}

function cents(value: number): number {
  return Math.round(value * 100) / 100
}

function day(tx: BankTransactionItem): string | null {
  return tx.operation_date
}

const NO_PAIR: Partial<BankTransactionItem> = {
  transfer_id: null, transfer_account_id: null, transfer_account_name: null, transfer_status: null,
  transfer_label: null, transfer_date: null, together_type: null,
}

/** The answers a question settles for good: it asks nothing anymore. */
const ANSWERED: Partial<BankTransactionItem> = { flow_question: null, asks_contribution: false }

/** Another operation of the same label, account and direction: the label's rule or yes reaches it. */
function sameLabel(a: BankTransactionItem, b: BankTransactionItem): boolean {
  return a.id !== b.id && a.account_id === b.account_id && a.is_credit === b.is_credit && a.label !== null
    && a.label === b.label
}

/** Facing the same investment account as `tx`, in the same direction. */
function sameShape(a: BankTransactionItem, b: BankTransactionItem): boolean {
  return sameLabel(a, b) && !!a.contribution && !!b.contribution
    && a.contribution.account_name === b.contribution.account_name
    && a.contribution.is_deposit === b.contribution.is_deposit
}

/** Each of these operations' amount, read from the question's own, its group's list or the month. */
function amountOf(id: string, known: BankTransactionItem[]): number {
  return Number(known.find((tx) => tx.id === id)?.amount ?? 0)
}

/**
 * Which operation of the label asks next is the reload's to say; but with no
 * other operation of this very label left in the month, the question cannot
 * stay in it. The label read loosely (a date in it) may still keep it there:
 * then the reload brings it back.
 */
function leavesMonth(carrier: BankTransactionItem, covered: string[], neighbours: BankTransactionItem[]): boolean {
  if (!neighbours.length || !covered.includes(carrier.id)) return false
  return !neighbours.some((other) =>
    sameLabel(other, carrier) && !covered.includes(other.id) && other.type_source === 'default'
    && other.transfer_status === null && !other.origin && !other.is_pending
    && (!carrier.asks_contribution || other.asks_contribution)
    && (other.operation_date ?? '') <= (carrier.operation_date ?? ''),
  )
}

/** A question answered on `covered` of its operations: closed when they are all of them. */
function closeOrShrink(
  effect: AnswerEffect, carrier: BankTransactionItem, covered: string[], known: BankTransactionItem[],
  neighbours: BankTransactionItem[] = [],
): void {
  const question = carrier.flow_question
  if (!question) return
  if (covered.length >= question.operation_count) {
    effect.settled.push({ ids: [carrier.id], day: day(carrier) })
    return
  }
  effect.shrunk[carrier.id] = {
    count: covered.length,
    amount: cents(covered.reduce((sum, id) => sum + amountOf(id, known), 0)),
  }
  if (leavesMonth(carrier, covered, neighbours)) (effect.movedOut ??= []).push(carrier.id)
}

/**
 * A type given to a label's question: to the operations ticked (or the one
 * asked about), or to the whole label through a rule.
 *
 * `members`: the group's operations when its list was opened; `neighbours`:
 * the other operations on screen (the month's).
 */
export function typeAnswerEffect(
  tx: BankTransactionItem, type: CashflowType, scope: TypeScope, picked: string[],
  members: BankTransactionItem[] = [], neighbours: BankTransactionItem[] = [],
): AnswerEffect {
  const effect: AnswerEffect = { operations: {}, settled: [], shrunk: {} }
  if (scope === 'label') {
    effect.operations[tx.id] = { ...ANSWERED, cashflow_type: type, type_source: 'rule' }
    // The rule passes after what the user said and any pair: only the labels read by default.
    for (const other of neighbours) {
      if (sameLabel(other, tx) && other.type_source === 'default' && other.transfer_status === null && !other.origin) {
        effect.operations[other.id] = { ...ANSWERED, cashflow_type: type, type_source: 'rule' }
      }
    }
    if (tx.flow_question) effect.settled.push({ ids: [tx.id], day: day(tx) })
    return effect
  }
  for (const id of picked) effect.operations[id] = { ...ANSWERED, cashflow_type: type, type_source: 'override' }
  closeOrShrink(effect, tx, picked, [tx, ...members, ...neighbours], neighbours)
  return effect
}

/**
 * Yes or no to the deposit or withdrawal facing the operation, or each of
 * those ticked. A yes vouches for the label: the other operations of it facing
 * their own movement of the very day are settled with it, those of its group
 * further off (known only once its list was opened) still ask. A no puts the
 * operations back with the others: whatever they ask then waits for the reload.
 */
export function contributionAnswerEffect(
  tx: BankTransactionItem, kind: BankContributionDecisionKind, answered: string[],
  members: BankTransactionItem[] = [], neighbours: BankTransactionItem[] = [],
): AnswerEffect {
  const effect: AnswerEffect = { operations: {}, settled: [], shrunk: {} }
  const known = [tx, ...members, ...neighbours]
  // Asked on another operation of the label (the month shows its question on the last one only).
  const carrier = tx.flow_question
    ? tx
    : neighbours.find((other) => other.flow_question && other.asks_contribution && sameShape(other, tx))

  if (kind === 'not_contribution') {
    for (const id of answered) effect.operations[id] = { ...ANSWERED }
    if (carrier) closeOrShrink(effect, carrier, answered, known, neighbours)
    return effect
  }

  const proved: Partial<BankTransactionItem> = {
    ...ANSWERED, cashflow_type: 'INVESTMENT', type_source: 'contribution',
  }
  for (const id of answered) effect.operations[id] = { ...proved }
  for (const other of neighbours) {
    if (other.asks_contribution && other.contribution?.exact && sameShape(other, tx)) effect.operations[other.id] = { ...proved }
  }
  // Said on a pair offered: the operation leaves it, and so does the other side.
  if (tx.transfer_status === 'suggested' && tx.transfer_id) {
    effect.operations[tx.id] = { ...proved, ...NO_PAIR }
    effect.operations[tx.transfer_id] = { ...NO_PAIR }
    effect.settled.push(pairQuestion(tx))
  }
  if (carrier) {
    const settledNow = new Set(Object.keys(effect.operations))
    const further = members.filter((member) => !settledNow.has(member.id) && !member.contribution?.exact)
    if (!further.length) effect.settled.push({ ids: [carrier.id], day: day(carrier) })
    else {
      const question = carrier.flow_question!
      effect.shrunk[carrier.id] = {
        count: question.operation_count - further.length,
        amount: cents(Number(question.amount) - further.reduce((sum, member) => sum + Number(member.amount), 0)),
      }
    }
  }
  return effect
}

/** The question a pair offered asks, held by its debit as the queue and the counts hold it. */
function pairQuestion(tx: BankTransactionItem): { ids: string[]; day: string | null } {
  const other = tx.transfer_id!
  return tx.is_credit
    ? { ids: [other, tx.id], day: tx.transfer_date ?? null }
    : { ids: [tx.id, other], day: day(tx) }
}

/** Ensemble: both sides pair for good, out of the totals; Pas ensemble: each counts on its own. */
export function transferAnswerEffect(tx: BankTransactionItem, kind: BankTransferDecisionKind): AnswerEffect {
  const effect: AnswerEffect = { operations: {}, settled: [], shrunk: {} }
  if (!tx.transfer_id) return effect
  const legs = [tx.id, tx.transfer_id]
  if (tx.transfer_status === 'suggested') effect.settled.push(pairQuestion(tx))
  for (const id of legs) {
    effect.operations[id] = kind === 'not_transfer'
      ? { ...NO_PAIR }
      // Offered pairs join two accounts: confirmed, never a reversal on one account.
      : { ...ANSWERED, transfer_status: 'confirmed', transfer_label: null, transfer_date: null, together_type: null }
  }
  return effect
}

// ── Applying them ───────────────────────────────────────────

function settles(effects: AnswerEffect[], id: string): boolean {
  return effects.some((effect) => effect.settled.some((question) => question.ids.includes(id)))
}

function yearOf(value: string | null): number | null {
  return value ? Number(value.slice(0, 4)) : null
}

/** The À trier queue once these answers are in: closed questions leave, the others count fewer operations. */
export function applyToQueue(queue: BankReviewQueue, effects: AnswerEffect[]): BankReviewQueue {
  if (!effects.length) return queue
  let count = Number(queue.total_count)
  let total = Number(queue.total_amount)
  const years = queue.years.map((entry) => ({ ...entry, amount: Number(entry.amount) }))
  const lower = (value: string | null, amount: number, closed: boolean) => {
    const entry = years.find((y) => y.year === yearOf(value))
    if (!entry) return
    entry.amount = cents(entry.amount - amount)
    if (closed) entry.count -= 1
  }

  const questions = queue.questions.flatMap((item) => {
    const tx = item.transaction
    if (settles(effects, tx.id)) {
      count -= 1
      total -= Number(item.amount)
      lower(tx.operation_date, Number(item.amount), true)
      return []
    }
    let operations = item.operation_count
    let amount = Number(item.amount)
    for (const effect of effects) {
      const gone = effect.shrunk[tx.id]
      if (!gone) continue
      operations -= gone.count
      amount = cents(amount - gone.amount)
      total -= gone.amount
      lower(tx.operation_date, gone.amount, false)
    }
    if (operations === item.operation_count) return [item]
    const question = tx.flow_question && { ...tx.flow_question, operation_count: operations, amount }
    return [{ ...item, operation_count: operations, amount, transaction: { ...tx, flow_question: question } }]
  })
  return {
    ...queue,
    total_count: count,
    total_amount: cents(total),
    years: years.filter((entry) => entry.count > 0),
    questions,
  }
}

/** Kept out of the month's totals: every pair but one offered. */
function deducted(tx: BankTransactionItem): boolean {
  return tx.transfer_status !== null && tx.transfer_status !== 'suggested'
}

/** The month once these answers are in: each operation as it now reads, the totals and the questions with it. */
export function applyToMonth(month: BankTransactionsResponse, effects: AnswerEffect[]): BankTransactionsResponse {
  if (!effects.length) return month
  const totals = {
    inflow: Number(month.inflow), outflow: Number(month.outflow),
    transfers: Number(month.internal_transfers_excluded), transfersAmount: Number(month.internal_transfers_amount),
    pending: Number(month.pending_count), pendingIn: Number(month.pending_inflow), pendingOut: Number(month.pending_outflow),
    questions: Number(month.transfer_questions),
  }
  const others = month.other_currencies.map((other) => ({ ...other, inflow: Number(other.inflow), outflow: Number(other.outflow) }))
  const ids = new Set(month.transactions.map((tx) => tx.id))
  const pairsOut = new Set<string>()

  const transactions = month.transactions.map((before) => {
    let tx = before
    for (const effect of effects) {
      const gone = effect.shrunk[tx.id]
      if (gone && tx.flow_question) {
        tx = {
          ...tx,
          flow_question: {
            ...tx.flow_question,
            operation_count: tx.flow_question.operation_count - gone.count,
            amount: cents(Number(tx.flow_question.amount) - gone.amount),
          },
        }
      }
      if (effect.settled.some((question) => question.ids[0] === tx.id) && tx.flow_question) tx = { ...tx, flow_question: null }
      const patch = effect.operations[tx.id]
      if (patch) tx = { ...tx, ...patch }
    }
    // A pair settled together leaves the totals, counted once among the transfers.
    if (deducted(tx) !== deducted(before) && !before.origin) {
      const sign = deducted(tx) ? -1 : 1
      const value = Number(before.amount)
      if (before.currency !== month.currency) {
        const other = others.find((entry) => entry.currency === before.currency)
        if (other) other[before.is_credit ? 'inflow' : 'outflow'] += sign * value
      } else if (before.is_pending) {
        totals.pending += sign
        totals[before.is_credit ? 'pendingIn' : 'pendingOut'] += sign * value
      } else {
        totals[before.is_credit ? 'inflow' : 'outflow'] += sign * value
      }
      const pair = [before.id, before.transfer_id].sort().join(':')
      if (deducted(tx) && !pairsOut.has(pair)) {
        pairsOut.add(pair)
        totals.transfers += 1
        totals.transfersAmount += value
      }
    }
    return tx
  })

  // A question closed counts once, whichever of its operations the month shows.
  const closed = new Set<string>()
  for (const effect of effects) {
    for (const question of effect.settled) {
      if (question.ids.some((id) => ids.has(id))) closed.add(question.ids[0]!)
    }
    for (const id of effect.movedOut ?? []) if (ids.has(id)) closed.add(id)
  }
  totals.questions -= closed.size

  return {
    ...month,
    inflow: cents(totals.inflow),
    outflow: cents(totals.outflow),
    net: cents(totals.inflow - totals.outflow),
    internal_transfers_excluded: totals.transfers,
    internal_transfers_amount: cents(totals.transfersAmount),
    pending_count: totals.pending,
    pending_inflow: cents(totals.pendingIn),
    pending_outflow: cents(totals.pendingOut),
    transfer_questions: Math.max(0, totals.questions),
    other_currencies: others.map((other) => ({ ...other, inflow: cents(other.inflow), outflow: cents(other.outflow) })),
    transactions,
  }
}

/** The questions counted for the tab and the months, less those closed. */
export function applyToQuestionCounts(
  counts: BankTransferQuestionsResponse, effects: AnswerEffect[],
): BankTransferQuestionsResponse {
  const closed = new Map<string, string | null>()
  for (const effect of effects) for (const question of effect.settled) closed.set(question.ids[0]!, question.day)
  if (!closed.size) return counts
  const months = counts.months.map((entry) => ({ ...entry }))
  for (const value of closed.values()) {
    const entry = value ? months.find((m) => m.period === value.slice(0, 7)) : undefined
    if (entry) entry.count -= 1
  }
  return {
    ...counts,
    total: Math.max(0, counts.total - closed.size),
    months: months.filter((entry) => entry.count > 0),
  }
}

/** The operations whose question stays open, fewer: answered again only once the reload says what is left. */
export function waitingOn(effects: AnswerEffect[]): Set<string> {
  return new Set(effects.flatMap((effect) => Object.keys(effect.shrunk)))
}
