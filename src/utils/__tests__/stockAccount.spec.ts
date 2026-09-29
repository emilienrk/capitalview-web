import { describe, expect, it } from 'vitest'
import { accountHeadline, fiveYearMark, readDepositCeiling } from '../stockAccount'
import type { AccountHistorySnapshotResponse } from '@/types'

describe('fiveYearMark', () => {
  it('donne la date des 5 ans tant qu’elle est à venir', () => {
    expect(fiveYearMark('2024-04-15', '2026-09-29')).toBe('2029-04-15')
  })

  it('ne donne plus rien une fois les 5 ans passés', () => {
    expect(fiveYearMark('2021-03-12', '2026-09-29')).toBeNull()
  })

  it('ne donne rien sans date d’ouverture', () => {
    expect(fiveYearMark(null, '2026-09-29')).toBeNull()
  })
})

describe('readDepositCeiling', () => {
  it('ne concerne pas un compte-titres', () => {
    expect(readDepositCeiling('CTO', 10_000, 0)).toBeNull()
  })

  it('mesure un PEA sur 150 000 €', () => {
    const reading = readDepositCeiling('PEA', 29_500, 2_182.1)!
    expect(reading.ceiling).toBe(150_000)
    expect(reading.remaining).toBe(120_500)
    expect(reading.atLeast).toBeNull()
    expect(reading.missingShare).toBe(0)
  })

  it('lit des liquidités négatives comme des versements manquants', () => {
    const reading = readDepositCeiling('PEA', 29_500, -1_840)!
    expect(reading.counted).toBe(29_500)
    expect(reading.atLeast).toBe(31_340)
    expect(reading.remaining).toBe(118_660)
    expect(reading.missingShare).toBeCloseTo(1_840 / 150_000)
  })

  it('mesure un PEA-PME avec le PEA sur 225 000 €', () => {
    const reading = readDepositCeiling('PEA_PME', 6_000, 412, 29_500)!
    expect(reading.ceiling).toBe(225_000)
    expect(reading.counted).toBe(35_500)
    expect(reading.remaining).toBe(189_500)
  })

  it('borne le reste d’un PEA par le plafond commun avec le PEA-PME', () => {
    expect(readDepositCeiling('PEA', 140_000, 0, 80_000)!.remaining).toBe(5_000)
  })
})

describe('accountHeadline', () => {
  const snapshot = (overrides: Partial<AccountHistorySnapshotResponse>): AccountHistorySnapshotResponse => ({
    snapshot_date: '2026-09-28',
    total_value: 0,
    total_invested: 0,
    total_deposits: 0,
    total_withdrawals: 0,
    daily_pnl: null,
    cumulative_pnl: null,
    total_fees: null,
    total_dividends: null,
    ...overrides,
  })

  it('prend la valeur du dernier relevé et le P/L des titres seuls', () => {
    const headline = accountHeadline([
      snapshot({ total_value: 1 }),
      snapshot({
        total_value: 1_100,
        positions: [
          { asset_key: 'FR0000120271', quantity: 10, value: 1_000, price: 100, invested: 800, percentage: 90 },
          { asset_key: 'EUR', quantity: 100, value: 100, price: 1, invested: 100, percentage: 10 },
        ],
      }),
    ])!
    expect(headline.value).toBe(1_100)
    expect(headline.profitLoss).toBe(200)
    expect(headline.profitLossPct).toBe(25)
  })

  it('ne donne rien sans relevé', () => {
    expect(accountHeadline([])).toBeNull()
  })
})
