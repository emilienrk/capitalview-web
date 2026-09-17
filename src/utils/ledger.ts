/**
 * The Explorer's engine: filters, groups and compares the ledger's operations
 * in the browser, so no filter change waits on a request.
 *
 * Nothing here decides how an operation counts. The API sends each row's type,
 * whether the real cashflow counts it and its amount signed in its type's
 * direction; this only picks rows and adds those amounts up.
 */
import type {
  BankLedger, BankLedgerAccount, BankLedgerGroup, BankReviewKind, BankTransferStatus, CashflowType, OperationType,
  TypeSource,
} from '@/types'
import { CASHFLOW_TYPES, CASHFLOW_TYPE_LABELS, OPERATION_TYPE_LABELS } from '@/utils/cashflowTypes'

export interface LedgerEntry {
  id: string
  /** YYYY-MM-DD, and its YYYY-MM; empty when the bank gave no date. */
  day: string
  period: string
  /** Unsigned, as the bank reports it. */
  amount: number
  /** Credit positive, debit negative: what the bank statement shows. */
  bankSigned: number
  /** Signed in its type's direction, zero when the real cashflow leaves it out. */
  signed: number
  currency: string
  isCredit: boolean
  isPending: boolean
  label: string
  account: BankLedgerAccount
  group: BankLedgerGroup & { id: string }
  operationType: OperationType
  cashflowType: CashflowType
  typeSource: TypeSource
  typeRuleId: string | null
  transferStatus: BankTransferStatus | null
  counted: boolean
  question: BankReviewKind | null
  open: boolean
  /** Label, counterpart and account, folded for searching. */
  haystack: string
}

export type PeriodPreset = 'month' | 'last-month' | '3m' | '12m' | 'ytd' | 'last-year' | 'all' | 'custom'
export type Direction = 'all' | 'in' | 'out'
export type Dimension = 'group' | 'month' | 'week' | 'account' | 'means' | 'type' | 'weekday' | 'amount-band'
export type ChartStack = 'type' | 'group'

export interface LedgerFilters {
  preset: PeriodPreset
  /** YYYY-MM, both ends included; used by the custom preset only. */
  from: string | null
  to: string | null
  accounts: string[]
  direction: Direction
  types: CashflowType[]
  means: OperationType[]
  min: number | null
  max: number | null
  query: string
  groups: string[]
  onlyOpen: boolean
  includePending: boolean
  /** Pairs between the user's own accounts and cancellations, which no total counts. */
  includeUncounted: boolean
}

export interface ExploreState {
  filters: LedgerFilters
  by: Dimension
  stack: ChartStack
  cumulative: boolean
}

export const DEFAULT_FILTERS: LedgerFilters = {
  preset: '12m',
  from: null,
  to: null,
  accounts: [],
  direction: 'all',
  types: [],
  means: [],
  min: null,
  max: null,
  query: '',
  groups: [],
  onlyOpen: false,
  includePending: false,
  includeUncounted: false,
}

export const DEFAULT_STATE: ExploreState = { filters: DEFAULT_FILTERS, by: 'group', stack: 'type', cumulative: false }

export interface PeriodRange {
  from: string
  to: string
}

// ── Periods ─────────────────────────────────────────────────

export function toPeriod(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function shiftPeriod(period: string, months: number): string {
  const [year, month] = period.split('-').map(Number)
  return toPeriod(new Date(year!, month! - 1 + months, 1))
}

export function periodsBetween(range: PeriodRange): string[] {
  const periods: string[] = []
  for (let p = range.from; p <= range.to; p = shiftPeriod(p, 1)) periods.push(p)
  return periods
}

/** The months a preset covers; null for the whole history. */
export function periodRange(filters: LedgerFilters, today: Date = new Date()): PeriodRange | null {
  const current = toPeriod(today)
  const lastCompleted = shiftPeriod(current, -1)
  switch (filters.preset) {
    case 'month':
      return { from: current, to: current }
    case 'last-month':
      return { from: lastCompleted, to: lastCompleted }
    case '3m':
      return { from: shiftPeriod(lastCompleted, -2), to: lastCompleted }
    case '12m':
      return { from: shiftPeriod(lastCompleted, -11), to: lastCompleted }
    case 'ytd':
      return { from: `${today.getFullYear()}-01`, to: current }
    case 'last-year':
      return { from: `${today.getFullYear() - 1}-01`, to: `${today.getFullYear() - 1}-12` }
    case 'custom':
      if (!filters.from || !filters.to) return null
      return filters.from <= filters.to ? { from: filters.from, to: filters.to } : { from: filters.to, to: filters.from }
    default:
      return null
  }
}

/** The range moved back (negative) or forward by `lengths` of itself. */
export function shiftRange(range: PeriodRange, lengths: number): PeriodRange {
  const months = periodsBetween(range).length * lengths
  return { from: shiftPeriod(range.from, months), to: shiftPeriod(range.to, months) }
}

// ── Reading the ledger ──────────────────────────────────────

export function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

export function groupId(group: BankLedgerGroup): string {
  return `${group.is_credit ? 'C' : 'D'}:${group.key}`
}

export function hydrate(ledger: BankLedger): LedgerEntry[] {
  const groups = ledger.groups.map((group) => ({ ...group, id: groupId(group) }))
  return ledger.rows.map((row) => {
    const account = ledger.accounts[row.account]!
    const group = groups[row.group]!
    const amount = Number(row.amount)
    const label = row.label ?? ''
    return {
      id: row.id,
      day: row.day ?? '',
      period: row.day ? row.day.slice(0, 7) : '',
      amount,
      bankSigned: row.is_credit ? amount : -amount,
      signed: Number(row.signed),
      currency: row.currency,
      isCredit: row.is_credit,
      isPending: row.is_pending,
      label,
      account,
      group,
      operationType: row.operation_type,
      cashflowType: row.cashflow_type,
      typeSource: row.type_source,
      typeRuleId: row.type_rule_id,
      transferStatus: row.transfer_status,
      counted: row.counted,
      question: row.question,
      open: row.open,
      haystack: fold(`${label} ${group.name} ${account.name}`),
    }
  })
}

// ── Filtering ───────────────────────────────────────────────

/** A search's words, folded once: required ones, and those after a "-" excluded. */
function queryWords(query: string): { required: string[]; excluded: string[] } {
  const required: string[] = []
  const excluded: string[] = []
  for (const word of fold(query).split(/\s+/).filter(Boolean)) {
    if (!word.startsWith('-')) required.push(word)
    else if (word.length > 1) excluded.push(word.slice(1))
  }
  return { required, excluded }
}

function matchesWords(haystack: string, words: { required: string[]; excluded: string[] }): boolean {
  return words.required.every((word) => haystack.includes(word)) && !words.excluded.some((word) => haystack.includes(word))
}

/** Every word required, a word starting with "-" excluded. */
export function matchesQuery(haystack: string, query: string): boolean {
  return matchesWords(haystack, queryWords(query))
}

/**
 * Every filter but the period, which comparisons move on their own. Filters are
 * read and the search folded once, not once per operation: the history runs
 * through this several times on every change.
 */
function matcher(filters: LedgerFilters): (entry: LedgerEntry) => boolean {
  const { includePending, includeUncounted, direction, min, max, onlyOpen } = filters
  const accounts = filters.accounts.length ? new Set(filters.accounts) : null
  const types = filters.types.length ? new Set<string>(filters.types) : null
  const means = filters.means.length ? new Set<string>(filters.means) : null
  const groups = filters.groups.length ? new Set(filters.groups) : null
  const words = queryWords(filters.query)
  const searching = words.required.length > 0 || words.excluded.length > 0
  return (entry) => {
    if (entry.isPending ? !includePending : !entry.counted && !includeUncounted) return false
    if (accounts && !accounts.has(entry.account.id)) return false
    if (direction === 'in' && !entry.isCredit) return false
    if (direction === 'out' && entry.isCredit) return false
    if (types && !types.has(entry.cashflowType)) return false
    if (means && !means.has(entry.operationType)) return false
    if (min !== null && entry.amount < min) return false
    if (max !== null && entry.amount > max) return false
    if (groups && !groups.has(entry.group.id)) return false
    if (onlyOpen && !entry.open) return false
    return !searching || matchesWords(entry.haystack, words)
  }
}

export function inRange(entry: LedgerEntry, range: PeriodRange | null): boolean {
  if (range === null) return true
  // An undated operation's empty period sorts before any month: never in range.
  return entry.period >= range.from && entry.period <= range.to
}

export function applyFilters(
  entries: LedgerEntry[], filters: LedgerFilters, range: PeriodRange | null, currency: string,
): LedgerEntry[] {
  // Amounts arrive unconverted: another currency would silently join the sums.
  const passes = matcher(filters)
  return entries.filter((entry) => entry.currency === currency && inRange(entry, range) && passes(entry))
}

// ── Adding up ───────────────────────────────────────────────

/**
 * How much an operation weighs in the direction looked at: spending reads
 * positive when looking at what went out, and a refund comes off it.
 */
export function flowValue(entry: LedgerEntry, direction: Direction): number {
  if (direction === 'out') return -entry.bankSigned
  return entry.bankSigned
}

/** Its amount in its type's direction, pending operations included. */
export function typedValue(entry: LedgerEntry): number {
  if (entry.counted) return entry.signed
  if (!entry.isPending) return 0
  if (entry.cashflowType === 'NEUTRAL') return entry.amount
  if (entry.cashflowType === 'INCOME') return entry.bankSigned
  return -entry.bankSigned
}

export interface Summary {
  count: number
  total: number
  inflow: number
  outflow: number
  byType: Record<CashflowType, number>
  averageTicket: number
  medianTicket: number
  openAmount: number
}

export function median(values: number[]): number {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2
}

export function summarize(entries: LedgerEntry[], direction: Direction = 'all'): Summary {
  const byType = Object.fromEntries(CASHFLOW_TYPES.map((type) => [type, 0])) as Record<CashflowType, number>
  let total = 0
  let inflow = 0
  let outflow = 0
  let openAmount = 0
  for (const entry of entries) {
    total += flowValue(entry, direction)
    if (entry.isCredit) inflow += entry.amount
    else outflow += entry.amount
    byType[entry.cashflowType] += typedValue(entry)
    if (entry.open) openAmount += entry.amount
  }
  const tickets = entries.map((entry) => entry.amount)
  return {
    count: entries.length,
    total,
    inflow,
    outflow,
    byType,
    averageTicket: entries.length ? tickets.reduce((sum, value) => sum + value, 0) / entries.length : 0,
    medianTicket: median(tickets),
    openAmount,
  }
}

export interface Comparison {
  range: PeriodRange
  total: number
  change: number | null
}

function compared(entries: LedgerEntry[], filters: LedgerFilters, range: PeriodRange, currency: string, total: number): Comparison {
  const previous = summarize(applyFilters(entries, filters, range, currency), filters.direction).total
  return { range, total: previous, change: previous === 0 ? null : ((total - previous) / Math.abs(previous)) * 100 }
}

/** The same filters over the period just before, and over the same months a year earlier. */
export function comparePeriods(
  entries: LedgerEntry[], filters: LedgerFilters, range: PeriodRange | null, currency: string,
): { previous: Comparison; lastYear: Comparison } | null {
  if (range === null) return null
  const total = summarize(applyFilters(entries, filters, range, currency), filters.direction).total
  return {
    previous: compared(entries, filters, shiftRange(range, -1), currency, total),
    lastYear: compared(entries, filters, { from: shiftPeriod(range.from, -12), to: shiftPeriod(range.to, -12) }, currency, total),
  }
}

// ── Grouping ────────────────────────────────────────────────

const WEEKDAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
const AMOUNT_BANDS: Array<{ key: string; label: string; below: number }> = [
  { key: '0', label: 'Moins de 10 €', below: 10 },
  { key: '1', label: '10 à 50 €', below: 50 },
  { key: '2', label: '50 à 100 €', below: 100 },
  { key: '3', label: '100 à 500 €', below: 500 },
  { key: '4', label: '500 € et plus', below: Infinity },
]

/** The amount filters matching a band: its lower bound, and just under its upper one. */
export function amountBandFilter(key: string): Pick<LedgerFilters, 'min' | 'max'> {
  const index = AMOUNT_BANDS.findIndex((band) => band.key === key)
  if (index < 0) return { min: null, max: null }
  const band = AMOUNT_BANDS[index]!
  return {
    min: index === 0 ? null : AMOUNT_BANDS[index - 1]!.below,
    max: Number.isFinite(band.below) ? band.below - 0.01 : null,
  }
}

export const DIMENSION_LABELS: Record<Dimension, string> = {
  group: 'Contrepartie',
  month: 'Mois',
  week: 'Semaine',
  account: 'Compte',
  means: 'Moyen de paiement',
  type: 'Type',
  weekday: 'Jour de la semaine',
  'amount-band': 'Tranche de montant',
}

function dayDate(day: string): Date {
  const [year, month, date] = day.split('-').map(Number)
  return new Date(year!, month! - 1, date!)
}

/** The Monday starting the week of a YYYY-MM-DD day, as YYYY-MM-DD. */
export function weekStart(day: string): string {
  const date = dayDate(day)
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7))
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// Built once: toLocaleDateString with options builds a formatter per call, and
// grouping the history by month or week formats thousands of dates.
const MONTH_FORMATS = {
  short: new Intl.DateTimeFormat('fr-FR', { month: 'short', year: 'numeric' }),
  long: new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }),
}
const WEEK_FORMAT = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })

export function monthLabel(period: string, style: 'short' | 'long' = 'short'): string {
  const [year, month] = period.split('-').map(Number)
  return MONTH_FORMATS[style].format(new Date(year!, month! - 1, 1))
}

/** The key and the name an operation falls under along a dimension. */
export function bucketOf(entry: LedgerEntry, dimension: Dimension): { key: string; label: string } {
  switch (dimension) {
    case 'group':
      return { key: entry.group.id, label: entry.group.name || 'Sans libellé' }
    case 'month':
      return { key: entry.period, label: entry.period ? monthLabel(entry.period) : 'Sans date' }
    case 'week': {
      if (!entry.day) return { key: '', label: 'Sans date' }
      const start = weekStart(entry.day)
      return { key: start, label: `Semaine du ${WEEK_FORMAT.format(dayDate(start))}` }
    }
    case 'account':
      return { key: entry.account.id, label: entry.account.name }
    case 'means':
      return {
        key: entry.operationType,
        label: entry.operationType === 'UNKNOWN' ? 'Non précisé' : OPERATION_TYPE_LABELS[entry.operationType],
      }
    case 'type':
      return { key: entry.cashflowType, label: CASHFLOW_TYPE_LABELS[entry.cashflowType] }
    case 'weekday': {
      if (!entry.day) return { key: '', label: 'Sans date' }
      const index = (dayDate(entry.day).getDay() + 6) % 7
      return { key: String(index), label: WEEKDAYS[index]! }
    }
    case 'amount-band': {
      const band = AMOUNT_BANDS.find((b) => entry.amount < b.below)!
      return { key: band.key, label: band.label }
    }
  }
}

export interface Bucket {
  key: string
  label: string
  total: number
  count: number
  /** Percent of the absolute totals of every bucket. */
  share: number
  averageTicket: number
  lastDay: string
  /** The bucket's total per month of `sparkPeriods`. */
  spark: number[]
}

/** Chronological dimensions keep their order; the others come heaviest first. */
const ORDERED: Dimension[] = ['month', 'week', 'weekday', 'amount-band']

export function groupBy(
  entries: LedgerEntry[], dimension: Dimension, direction: Direction, sparkPeriods: string[] = [],
): Bucket[] {
  const buckets = new Map<string, Bucket>()
  const sparkIndex = new Map(sparkPeriods.map((period, index) => [period, index]))
  for (const entry of entries) {
    const { key, label } = bucketOf(entry, dimension)
    let bucket = buckets.get(key)
    if (!bucket) {
      bucket = { key, label, total: 0, count: 0, share: 0, averageTicket: 0, lastDay: '', spark: sparkPeriods.map(() => 0) }
      buckets.set(key, bucket)
    }
    const value = flowValue(entry, direction)
    bucket.total += value
    bucket.count += 1
    bucket.averageTicket += entry.amount
    if (entry.day > bucket.lastDay) bucket.lastDay = entry.day
    const index = sparkIndex.get(entry.period)
    if (index !== undefined) bucket.spark[index]! += value
  }
  const all = [...buckets.values()]
  const weight = all.reduce((sum, bucket) => sum + Math.abs(bucket.total), 0)
  for (const bucket of all) {
    bucket.share = weight ? (Math.abs(bucket.total) / weight) * 100 : 0
    bucket.averageTicket = bucket.count ? bucket.averageTicket / bucket.count : 0
  }
  return ORDERED.includes(dimension)
    ? all.sort((a, b) => a.key.localeCompare(b.key))
    : all.sort((a, b) => Math.abs(b.total) - Math.abs(a.total) || a.label.localeCompare(b.label))
}

// ── Over time ───────────────────────────────────────────────

export interface Series {
  key: string
  label: string
  values: number[]
}

export interface TimeSeries {
  granularity: 'week' | 'month'
  buckets: string[]
  series: Series[]
}

export const OTHERS = 'others'
const TOP_SERIES = 5

/** A period of three months or less reads by week, anything longer by month. */
export function timeSeries(
  entries: LedgerEntry[], range: PeriodRange, stack: ChartStack, direction: Direction,
): TimeSeries {
  const periods = periodsBetween(range)
  const granularity = periods.length <= 3 ? 'week' : 'month'
  let buckets: string[]
  if (granularity === 'month') {
    buckets = periods
  } else {
    buckets = []
    const end = dayDate(`${shiftPeriod(range.to, 1)}-01`)
    for (let day = dayDate(weekStart(`${range.from}-01`)); day < end; day.setDate(day.getDate() + 7)) {
      buckets.push(`${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`)
    }
  }
  const indexOf = new Map(buckets.map((bucket, index) => [bucket, index]))
  const bucketKey = (entry: LedgerEntry) => (granularity === 'month' ? entry.period : entry.day ? weekStart(entry.day) : '')

  if (stack === 'type') {
    const series = CASHFLOW_TYPES.filter((type) => type !== 'NEUTRAL').map((type) => ({
      key: type, label: CASHFLOW_TYPE_LABELS[type], values: buckets.map(() => 0),
    }))
    const byKey = new Map<string, Series>(series.map((s) => [s.key, s]))
    for (const entry of entries) {
      const index = indexOf.get(bucketKey(entry))
      const target = byKey.get(entry.cashflowType)
      if (index !== undefined && target) target.values[index]! += typedValue(entry)
    }
    return { granularity, buckets, series: series.filter((s) => s.values.some((value) => value !== 0)) }
  }

  const top = groupBy(entries, 'group', direction).slice(0, TOP_SERIES)
  const topIds = new Set(top.map((bucket) => bucket.key))
  const series: Series[] = [
    ...top.map((bucket) => ({ key: bucket.key, label: bucket.label, values: buckets.map(() => 0) })),
    { key: OTHERS, label: 'Autres', values: buckets.map(() => 0) },
  ]
  const byKey = new Map(series.map((s) => [s.key, s]))
  for (const entry of entries) {
    const index = indexOf.get(bucketKey(entry))
    if (index === undefined) continue
    byKey.get(topIds.has(entry.group.id) ? entry.group.id : OTHERS)!.values[index]! += flowValue(entry, direction)
  }
  return { granularity, buckets, series: series.filter((s) => s.values.some((value) => value !== 0)) }
}

/**
 * The period and the same months a year earlier, each added up month after
 * month: where this year stands against the last one at the same point.
 */
export function cumulated(
  entries: LedgerEntry[], filters: LedgerFilters, range: PeriodRange, currency: string,
): { periods: string[]; current: number[]; lastYear: number[] } {
  const periods = periodsBetween(range)
  const earlier = { from: shiftPeriod(range.from, -12), to: shiftPeriod(range.to, -12) }
  const running = (selected: LedgerEntry[], months: string[]) => {
    const index = new Map(months.map((period, i) => [period, i]))
    const values = months.map(() => 0)
    for (const entry of selected) {
      const i = index.get(entry.period)
      if (i !== undefined) values[i]! += flowValue(entry, filters.direction)
    }
    for (let i = 1; i < values.length; i++) values[i]! += values[i - 1]!
    return values
  }
  return {
    periods,
    current: running(applyFilters(entries, filters, range, currency), periods),
    lastYear: running(applyFilters(entries, filters, earlier, currency), periodsBetween(earlier)),
  }
}

// ── Export ──────────────────────────────────────────────────

function csvCell(value: string): string {
  return /[;"\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

/** Semicolons and decimal commas, as a French spreadsheet opens them; a BOM so accents survive. */
export function toCsv(entries: LedgerEntry[]): string {
  const header = ['Date', 'Compte', 'Libellé', 'Contrepartie', 'Montant', 'Devise', 'Type', 'Moyen de paiement', 'En attente']
  const lines = entries.map((entry) => [
    entry.day,
    entry.account.name,
    entry.label,
    entry.group.name,
    entry.bankSigned.toFixed(2).replace('.', ','),
    entry.currency,
    CASHFLOW_TYPE_LABELS[entry.cashflowType],
    entry.operationType === 'UNKNOWN' ? '' : OPERATION_TYPE_LABELS[entry.operationType],
    entry.isPending ? 'oui' : 'non',
  ].map(csvCell).join(';'))
  return `\uFEFF${[header.join(';'), ...lines].join('\r\n')}\r\n`
}

// ── The URL ─────────────────────────────────────────────────

const PRESETS: PeriodPreset[] = ['month', 'last-month', '3m', '12m', 'ytd', 'last-year', 'all', 'custom']
const DIRECTIONS: Direction[] = ['all', 'in', 'out']
const DIMENSIONS = Object.keys(DIMENSION_LABELS) as Dimension[]
const MEANS: OperationType[] = ['CARD', 'TRANSFER', 'DIRECT_DEBIT', 'WITHDRAWAL', 'INTEREST', 'UNKNOWN']
const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/

type Query = Record<string, string | undefined>

function list(value: string | undefined): string[] {
  return value ? value.split(',').filter(Boolean) : []
}

function amount(value: string | undefined): number | null {
  if (value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

/** Only what differs from the defaults, so a plain Explorer has a plain URL. */
export function serializeState(state: ExploreState): Query {
  const f = state.filters
  const query: Query = {}
  if (f.preset !== DEFAULT_FILTERS.preset) query.p = f.preset
  if (f.preset === 'custom') {
    if (f.from) query.from = f.from
    if (f.to) query.to = f.to
  }
  if (f.accounts.length) query.acc = f.accounts.join(',')
  if (f.direction !== 'all') query.dir = f.direction
  if (f.types.length) query.types = f.types.join(',')
  if (f.means.length) query.means = f.means.join(',')
  if (f.min !== null) query.min = String(f.min)
  if (f.max !== null) query.max = String(f.max)
  if (f.query.trim()) query.q = f.query.trim()
  // Group keys are sorted words: a comma never appears in one.
  if (f.groups.length) query.groups = f.groups.join(',')
  if (f.onlyOpen) query.open = '1'
  if (f.includePending) query.pending = '1'
  if (f.includeUncounted) query.all = '1'
  if (state.by !== DEFAULT_STATE.by) query.by = state.by
  if (state.stack !== DEFAULT_STATE.stack) query.stack = state.stack
  if (state.cumulative) query.cum = '1'
  return query
}

/** Anything unknown or malformed falls back to its default, never to an error. */
export function parseState(query: Query): ExploreState {
  const preset = PRESETS.includes(query.p as PeriodPreset) ? (query.p as PeriodPreset) : DEFAULT_FILTERS.preset
  return {
    filters: {
      preset,
      from: query.from && PERIOD.test(query.from) ? query.from : null,
      to: query.to && PERIOD.test(query.to) ? query.to : null,
      accounts: list(query.acc),
      direction: DIRECTIONS.includes(query.dir as Direction) ? (query.dir as Direction) : 'all',
      types: list(query.types).filter((type): type is CashflowType => CASHFLOW_TYPES.includes(type as CashflowType)),
      means: list(query.means).filter((means): means is OperationType => MEANS.includes(means as OperationType)),
      min: amount(query.min),
      max: amount(query.max),
      query: query.q ?? '',
      groups: list(query.groups),
      onlyOpen: query.open === '1',
      includePending: query.pending === '1',
      includeUncounted: query.all === '1',
    },
    by: DIMENSIONS.includes(query.by as Dimension) ? (query.by as Dimension) : DEFAULT_STATE.by,
    stack: query.stack === 'group' ? 'group' : 'type',
    cumulative: query.cum === '1',
  }
}

/** The route query opening the Explorer on these filters, from another view. */
export function exploreLink(filters: Partial<LedgerFilters>, view: Partial<Omit<ExploreState, 'filters'>> = {}): Query {
  return { view: 'explore', ...serializeState({ ...DEFAULT_STATE, ...view, filters: { ...DEFAULT_FILTERS, ...filters } }) }
}
