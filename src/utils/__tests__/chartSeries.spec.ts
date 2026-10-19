import { describe, expect, it } from 'vitest'
import { hideNegligibleAccounts } from '../chartSeries'
import type { AccountHistorySnapshotResponse } from '@/types'

function line(name: string, ...values: number[]) {
  return {
    name,
    history: values.map((total_value, i) => ({
      snapshot_date: `2026-10-${String(i + 1).padStart(2, '0')}`,
      total_value,
    })) as AccountHistorySnapshotResponse[],
  }
}

const hidden = (lines: ReturnType<typeof line>[]) =>
  hideNegligibleAccounts(lines).map((l) => [l.name, l.hidden])

describe('hideNegligibleAccounts', () => {
  it('masque un compte vidé à côté d’un compte qui vaut plus', () => {
    expect(hidden([line('PEA', 15000, 15400), line('CTO', 2000, 0)])).toEqual([
      ['PEA', false],
      ['CTO', true],
    ])
  })

  it('masque aussi un compte à quelques euros', () => {
    expect(hidden([line('PEA', 15400), line('CTO', 7.5)])).toEqual([
      ['PEA', false],
      ['CTO', true],
    ])
  })

  it('montre un compte de 10 € ou plus', () => {
    expect(hidden([line('PEA', 15400), line('CTO', 10)])[1]).toEqual(['CTO', false])
  })

  it('ne masque rien quand aucun compte ne vaut plus', () => {
    expect(hidden([line('PEA', 0), line('CTO', 0)])).toEqual([
      ['PEA', false],
      ['CTO', false],
    ])
  })
})
