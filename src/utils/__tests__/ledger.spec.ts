import { describe, expect, it } from 'vitest'

import {
  DEFAULT_FILTERS, DEFAULT_STATE, amountBandFilter, applyFilters, bucketOf, comparePeriods, cumulated, exploreLink, flowValue, groupBy, hydrate,
  matchesQuery, parseState, periodRange, serializeState, shiftRange, summarize, timeSeries, toCsv, typedValue,
  weekStart, type LedgerFilters,
} from '@/utils/ledger'
import type { BankLedger, BankLedgerRow } from '@/types'

const TODAY = new Date(2026, 8, 16) // 16 September 2026

function row(overrides: Partial<BankLedgerRow>): BankLedgerRow {
  return {
    id: overrides.id ?? `r-${Math.random()}`,
    account: 0,
    group: 0,
    day: '2026-08-10',
    amount: 10,
    currency: 'EUR',
    is_credit: false,
    is_pending: false,
    label: 'CARTE 09/08/26 CARREFOUR ANNECY CB*0837',
    operation_type: 'CARD',
    cashflow_type: 'EXPENSE',
    type_source: 'default',
    type_rule_id: null,
    transfer_status: null,
    counted: true,
    signed: 10,
    question: null,
    open: false,
    ...overrides,
  }
}

function ledger(rows: BankLedgerRow[]): BankLedger {
  return {
    currency: 'EUR',
    accounts: [
      { id: 'current', name: 'Principal', type: 'CHECKING', institution: null, currency: 'EUR', balance: 0, first_day: null, covered_until: null, linked: true },
      { id: 'neobank', name: 'Secondaire', type: 'CHECKING', institution: null, currency: 'EUR', balance: 0, first_day: null, covered_until: null, linked: true },
    ],
    groups: [
      { key: 'annecy carrefour', name: 'Carrefour Annecy', is_credit: false },
      { key: 'employeur', name: 'Employeur', is_credit: true },
      { key: 'vinted', name: 'Vinted', is_credit: false },
      { key: 'vinted', name: 'Vinted', is_credit: true },
    ],
    rows,
  }
}

function filters(overrides: Partial<LedgerFilters> = {}): LedgerFilters {
  return { ...DEFAULT_FILTERS, ...overrides }
}

describe('periodRange', () => {
  it('reads each preset from today', () => {
    const range = (preset: LedgerFilters['preset']) => periodRange(filters({ preset }), TODAY)
    expect(range('month')).toEqual({ from: '2026-09', to: '2026-09' })
    expect(range('last-month')).toEqual({ from: '2026-08', to: '2026-08' })
    expect(range('3m')).toEqual({ from: '2026-06', to: '2026-08' })
    expect(range('12m')).toEqual({ from: '2025-09', to: '2026-08' })
    expect(range('ytd')).toEqual({ from: '2026-01', to: '2026-09' })
    expect(range('last-year')).toEqual({ from: '2025-01', to: '2025-12' })
    expect(range('all')).toBeNull()
  })

  it('orders a custom range and needs both ends', () => {
    expect(periodRange(filters({ preset: 'custom', from: '2026-05', to: '2026-02' }), TODAY)).toEqual({ from: '2026-02', to: '2026-05' })
    expect(periodRange(filters({ preset: 'custom', from: '2026-05', to: null }), TODAY)).toBeNull()
  })

  it('moves a range by its own length', () => {
    expect(shiftRange({ from: '2026-01', to: '2026-03' }, -1)).toEqual({ from: '2025-10', to: '2025-12' })
    expect(shiftRange({ from: '2026-01', to: '2026-03' }, 1)).toEqual({ from: '2026-04', to: '2026-06' })
  })
})

describe('applyFilters', () => {
  const entries = hydrate(ledger([
    row({ id: 'card', amount: 42.5, signed: 42.5 }),
    row({ id: 'salary', group: 1, is_credit: true, amount: 1500, signed: 1500, cashflow_type: 'INCOME', operation_type: 'TRANSFER', label: 'VIR SEPA EMPLOYEUR' }),
    row({ id: 'pending', is_pending: true, counted: false, signed: 0 }),
    row({ id: 'pair', account: 1, cashflow_type: 'NEUTRAL', transfer_status: 'recurring', counted: false, signed: 0, label: 'Recharge Apple Pay' }),
    row({ id: 'old', day: '2024-02-01' }),
    row({ id: 'chf', currency: 'CHF', label: 'DENNER GENEVE' }),
    row({ id: 'open', group: 2, label: 'Vinted', amount: 250, signed: 250, open: true, account: 1, operation_type: 'UNKNOWN' }),
  ]))
  const ids = (overrides: Partial<LedgerFilters>, range = periodRange(filters(overrides), TODAY)) =>
    applyFilters(entries, filters(overrides), range, 'EUR').map((entry) => entry.id)

  it('keeps counted operations of the period in the headline currency', () => {
    expect(ids({})).toEqual(['card', 'salary', 'open'])
  })

  it('adds pending operations and uncounted pairs only when asked', () => {
    expect(ids({ includePending: true })).toEqual(['card', 'salary', 'pending', 'open'])
    expect(ids({ includeUncounted: true })).toEqual(['card', 'salary', 'pair', 'open'])
  })

  it('filters on accounts, direction, types, means, amounts, groups and open questions', () => {
    expect(ids({ accounts: ['neobank'] })).toEqual(['open'])
    expect(ids({ direction: 'in' })).toEqual(['salary'])
    expect(ids({ direction: 'out' })).toEqual(['card', 'open'])
    expect(ids({ types: ['INCOME'] })).toEqual(['salary'])
    expect(ids({ means: ['UNKNOWN'] })).toEqual(['open'])
    expect(ids({ min: 42.5, max: 250 })).toEqual(['card', 'open'])
    expect(ids({ groups: ['D:vinted'] })).toEqual(['open'])
    expect(ids({ onlyOpen: true })).toEqual(['open'])
  })

  it('reads the whole history without a period', () => {
    expect(ids({ preset: 'all' }, null)).toEqual(['card', 'salary', 'old', 'open'])
  })
})

describe('matchesQuery', () => {
  it('needs every word, ignores accents and case, and excludes a word after a minus', () => {
    expect(matchesQuery('carte carrefour annecy principal', 'CARREFOUR annécy')).toBe(true)
    expect(matchesQuery('carte carrefour annecy principal', 'carrefour lyon')).toBe(false)
    expect(matchesQuery('carte carrefour annecy principal', 'carrefour -annecy')).toBe(false)
    expect(matchesQuery('carte carrefour annecy principal', 'carrefour -')).toBe(true)
  })

  it('searches the counterpart and the account too', () => {
    const [entry] = hydrate(ledger([row({ label: 'CB 1234' })]))
    expect(matchesQuery(entry!.haystack, 'annecy principal')).toBe(true)
  })
})

describe('adding up', () => {
  const entries = hydrate(ledger([
    row({ amount: 120, signed: 120 }),
    row({ amount: 40, signed: -40, is_credit: true, label: 'Virement de : TITOUAN' }),
    row({ amount: 2000, signed: 2000, is_credit: true, cashflow_type: 'INCOME', group: 1 }),
    row({ amount: 30, signed: 0, counted: false, is_pending: true }),
    row({ amount: 300, signed: 0, counted: false, cashflow_type: 'NEUTRAL', transfer_status: 'recurring' }),
    row({ amount: 10, signed: 0, counted: false, is_pending: true, is_credit: true, cashflow_type: 'INCOME' }),
    row({ amount: 5, signed: 0, counted: false, is_pending: true, is_credit: true, cashflow_type: 'NEUTRAL', open: true }),
  ]))

  it('weighs an operation in the direction looked at', () => {
    expect(flowValue(entries[0]!, 'out')).toBe(120)
    expect(flowValue(entries[1]!, 'out')).toBe(-40)
    expect(flowValue(entries[1]!, 'all')).toBe(40)
    expect(flowValue(entries[0]!, 'in')).toBe(-120)
  })

  it('counts a pending operation in its type, never an uncounted pair', () => {
    expect(entries.map(typedValue)).toEqual([120, -40, 2000, 30, 0, 10, 5])
  })

  it('sums the selection', () => {
    const summary = summarize(entries.slice(0, 3), 'all')
    expect(summary).toMatchObject({ count: 3, total: 1920, inflow: 2040, outflow: 120, averageTicket: 720, medianTicket: 120, openAmount: 0 })
    expect(summary.byType).toMatchObject({ EXPENSE: 80, INCOME: 2000, SAVING: 0 })
    expect(summarize(entries, 'all').openAmount).toBe(5)
    expect(summarize(entries.slice(0, 2), 'all').medianTicket).toBe(80)
  })
})

describe('comparePeriods', () => {
  const entries = hydrate(ledger([
    row({ day: '2026-08-05', amount: 110 }),
    row({ day: '2026-07-05', amount: 100 }),
    row({ day: '2025-08-05', amount: 55 }),
    row({ day: '2025-08-06', amount: 1, currency: 'CHF' }),
  ]))

  it('reads the same filters over the period before and a year before', () => {
    const selection = filters({ preset: 'last-month', direction: 'out' })
    const result = comparePeriods(entries, selection, periodRange(selection, TODAY), 'EUR')
    expect(result?.previous).toMatchObject({ range: { from: '2026-07', to: '2026-07' }, total: 100 })
    expect(result?.previous.change).toBeCloseTo(10)
    expect(result?.lastYear).toMatchObject({ range: { from: '2025-08', to: '2025-08' }, total: 55, change: 100 })
  })

  it('reads a year before over the same months, however long the period', () => {
    const selection = filters({ preset: 'custom', from: '2026-07', to: '2026-08', direction: 'out' })
    expect(comparePeriods(entries, selection, periodRange(selection, TODAY), 'EUR')?.lastYear.range).toEqual({ from: '2025-07', to: '2025-08' })
  })

  it('has nothing to compare over the whole history or against nothing', () => {
    expect(comparePeriods(entries, filters({ preset: 'all' }), null, 'EUR')).toBeNull()
    const selection = filters({ preset: 'custom', from: '2024-01', to: '2024-01' })
    expect(comparePeriods(entries, selection, periodRange(selection, TODAY), 'EUR')?.previous.change).toBeNull()
  })
})

describe('groupBy', () => {
  const entries = hydrate(ledger([
    row({ day: '2026-08-10', amount: 30, group: 0 }),
    row({ day: '2026-07-01', amount: 20, group: 0 }),
    row({ day: '2026-08-12', amount: 150, group: 2, label: 'Vinted' }),
    row({ day: '2026-06-02', amount: 10, is_credit: true, group: 3, label: 'Vinted' }),
  ]))

  it('puts the heaviest counterpart first, with its share, ticket and months', () => {
    const buckets = groupBy(entries, 'group', 'out', ['2026-06', '2026-07', '2026-08'])
    expect(buckets.map((b) => [b.key, b.label, b.total, b.count, b.averageTicket, b.lastDay, b.spark])).toEqual([
      ['D:vinted', 'Vinted', 150, 1, 150, '2026-08-12', [0, 0, 150]],
      ['D:annecy carrefour', 'Carrefour Annecy', 50, 2, 25, '2026-08-10', [0, 20, 30]],
      ['C:vinted', 'Vinted', -10, 1, 10, '2026-06-02', [-10, 0, 0]],
    ])
    // Of 210 € moved in all, whatever the direction.
    expect(buckets.map((b) => Math.round(b.share * 10) / 10)).toEqual([71.4, 23.8, 4.8])
  })

  it('weighs a refund as much as a purchase when ranking', () => {
    const refunded = hydrate(ledger([
      row({ amount: 30, group: 0 }),
      row({ amount: 500, is_credit: true, group: 3, label: 'Vinted' }),
      row({ amount: 30, group: 2, label: 'Vinted' }),
    ]))
    expect(groupBy(refunded, 'group', 'out').map((b) => b.label)).toEqual(['Vinted', 'Carrefour Annecy', 'Vinted'])
    expect(groupBy(refunded, 'group', 'out')[0]!.total).toBe(-500)
  })

  it('keeps chronological dimensions in order', () => {
    expect(groupBy(entries, 'month', 'out').map((b) => b.key)).toEqual(['2026-06', '2026-07', '2026-08'])
  })

  it('reads a week from its Monday, a weekday and an amount band', () => {
    expect(weekStart('2026-08-16')).toBe('2026-08-10') // a Sunday
    expect(weekStart('2026-08-10')).toBe('2026-08-10')
    expect(bucketOf(entries[0]!, 'weekday')).toEqual({ key: '0', label: 'Lundi' })
    expect(bucketOf(entries[0]!, 'amount-band')).toEqual({ key: '1', label: '10 à 50 €' })
    expect(bucketOf(entries[2]!, 'amount-band')).toEqual({ key: '3', label: '100 à 500 €' })
    expect(bucketOf(hydrate(ledger([row({ amount: 9.99 })]))[0]!, 'amount-band').key).toBe('0')
    expect(bucketOf(hydrate(ledger([row({ amount: 500 })]))[0]!, 'amount-band').key).toBe('4')
  })
})

describe('timeSeries', () => {
  const entries = hydrate(ledger([
    row({ day: '2026-08-10', amount: 30, signed: 30 }),
    row({ day: '2026-07-01', amount: 20, signed: 20, group: 2 }),
    row({ day: '2026-08-03', amount: 1000, signed: 1000, is_credit: true, cashflow_type: 'INCOME', group: 1 }),
  ]))

  it('reads a long period by month, stacked by type, empty types left out', () => {
    const series = timeSeries(entries, { from: '2026-04', to: '2026-08' }, 'type', 'all')
    expect(series.granularity).toBe('month')
    expect(series.buckets).toEqual(['2026-04', '2026-05', '2026-06', '2026-07', '2026-08'])
    expect(series.series.map((s) => [s.key, s.values])).toEqual([
      ['INCOME', [0, 0, 0, 0, 1000]],
      ['EXPENSE', [0, 0, 0, 20, 30]],
    ])
  })

  it('reads three months or less by week, stacked by counterpart', () => {
    const series = timeSeries(entries, { from: '2026-07', to: '2026-08' }, 'group', 'out')
    expect(series.granularity).toBe('week')
    expect(timeSeries(entries, { from: '2026-06', to: '2026-08' }, 'group', 'out').granularity).toBe('week')
    expect(timeSeries(entries, { from: '2026-05', to: '2026-08' }, 'group', 'out').granularity).toBe('month')
    expect(series.buckets[0]).toBe('2026-06-29')
    expect(series.buckets.at(-1)).toBe('2026-08-31')
    const aug10 = series.buckets.indexOf('2026-08-10')
    expect(series.series.find((s) => s.key === 'D:annecy carrefour')?.values[aug10]).toBe(30)
    expect(series.series.find((s) => s.key === 'C:employeur')?.values[series.buckets.indexOf('2026-08-03')]).toBe(-1000)
  })
})

describe('cumulated', () => {
  it('adds the period and the year before month after month', () => {
    const entries = hydrate(ledger([
      row({ day: '2026-01-10', amount: 10 }),
      row({ day: '2026-03-10', amount: 30 }),
      row({ day: '2025-02-10', amount: 5 }),
    ]))
    const selection = filters({ preset: 'custom', from: '2026-01', to: '2026-03', direction: 'out' })
    expect(cumulated(entries, selection, { from: '2026-01', to: '2026-03' }, 'EUR')).toEqual({
      periods: ['2026-01', '2026-02', '2026-03'],
      current: [10, 10, 40],
      lastYear: [0, 5, 5],
    })
  })
})

describe('toCsv', () => {
  it('writes French decimals, quotes what needs it and starts with a BOM', () => {
    const [entry] = hydrate(ledger([row({ day: '2026-08-10', amount: 42.5, label: 'CARTE "A;B"' })]))
    const csv = toCsv([entry!])
    expect(csv.startsWith('\uFEFFDate;Compte;Libellé;Contrepartie;Montant;Devise;Type;Moyen de paiement;En attente\r\n')).toBe(true)
    expect(csv).toContain('2026-08-10;Principal;"CARTE ""A;B""";Carrefour Annecy;-42,50;EUR;Dépense;Carte;non\r\n')
  })
})

describe('the URL', () => {
  it('writes only what differs from the defaults', () => {
    expect(serializeState(DEFAULT_STATE)).toEqual({})
  })

  it('reads back everything it wrote', () => {
    const state = {
      filters: filters({
        preset: 'custom', from: '2025-01', to: '2025-06', accounts: ['a', 'b'], direction: 'out', types: ['EXPENSE', 'SAVING'],
        means: ['CARD'], min: 10, max: 200.5, query: 'carrefour -annecy', groups: ['D:annecy carrefour'],
        onlyOpen: true, includePending: true, includeUncounted: true,
      }),
      by: 'month',
      stack: 'group',
      cumulative: true,
    } as const
    expect(parseState(serializeState(state))).toEqual(state)
  })

  it('falls back to the defaults on anything unknown', () => {
    expect(parseState({ p: 'forever', from: '2025-13', dir: 'sideways', types: 'BOGUS,INCOME', min: '-3', max: 'lots', by: 'colour', stack: 'x' })).toEqual({
      ...DEFAULT_STATE,
      filters: filters({ types: ['INCOME'] }),
    })
  })
})

describe('exploreLink', () => {
  it('opens the Explorer on a year of one counterpart', () => {
    expect(exploreLink({ preset: 'custom', from: '2026-01', to: '2026-08', groups: ['D:lidl'] }, { by: 'month' })).toEqual({
      view: 'explore', p: 'custom', from: '2026-01', to: '2026-08', groups: 'D:lidl', by: 'month',
    })
  })
})

describe('amountBandFilter', () => {
  it('filters on a band, open at both ends', () => {
    expect(amountBandFilter('0')).toEqual({ min: null, max: 9.99 })
    expect(amountBandFilter('2')).toEqual({ min: 50, max: 99.99 })
    expect(amountBandFilter('4')).toEqual({ min: 500, max: null })
    expect(amountBandFilter('nope')).toEqual({ min: null, max: null })
  })

  it('keeps every operation of the band it came from', () => {
    const entries = hydrate(ledger([row({ amount: 50 }), row({ amount: 99.99 }), row({ amount: 100 }), row({ amount: 49.99 })]))
    const band = amountBandFilter('2')
    const kept = applyFilters(entries, filters({ preset: 'all', ...band }), null, 'EUR')
    expect(kept.map((e) => e.amount)).toEqual([50, 99.99])
    expect(kept.every((e) => bucketOf(e, 'amount-band').key === '2')).toBe(true)
  })
})
