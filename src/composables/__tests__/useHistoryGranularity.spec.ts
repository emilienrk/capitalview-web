import { describe, expect, it } from 'vitest'
import {
  bucketHistoryByGranularity,
  getHistoryBucketKey,
  getHistorySpanDays,
  getIsoWeekKey,
} from '../useHistoryGranularity'

function snap(date: string, value = 0) {
  return { snapshot_date: date, total_value: value }
}

describe('getIsoWeekKey', () => {
  it('computes ISO week with year rollover', () => {
    // 2024-12-30 (Monday) belongs to ISO week 1 of 2025
    expect(getIsoWeekKey('2024-12-30')).toBe('2025-W01')
    expect(getIsoWeekKey('2025-01-05')).toBe('2025-W01')
    expect(getIsoWeekKey('2025-01-06')).toBe('2025-W02')
  })

  it('returns the raw string for invalid dates', () => {
    expect(getIsoWeekKey('not-a-date')).toBe('not-a-date')
  })
})

describe('getHistoryBucketKey', () => {
  it('buckets by month and year', () => {
    expect(getHistoryBucketKey('2025-03-14', 'monthly')).toBe('2025-03')
    expect(getHistoryBucketKey('2025-03-14', 'yearly')).toBe('2025')
    expect(getHistoryBucketKey('2025-03-14', 'daily')).toBe('2025-03-14')
  })
})

describe('bucketHistoryByGranularity', () => {
  it('returns history untouched for daily granularity', () => {
    const history = [snap('2025-01-02'), snap('2025-01-01')]
    expect(bucketHistoryByGranularity(history, 'daily')).toEqual(history)
  })

  it('keeps the latest point of each period even when input is unsorted', () => {
    const history = [
      snap('2025-01-20', 3), // later point, listed first on purpose
      snap('2025-01-05', 1),
      snap('2025-02-10', 4),
      snap('2025-01-12', 2),
    ]
    const monthly = bucketHistoryByGranularity(history, 'monthly')
    expect(monthly).toEqual([snap('2025-01-20', 3), snap('2025-02-10', 4)])
  })

  it('buckets by ISO week', () => {
    const history = [
      snap('2025-01-06', 1), // Monday W02
      snap('2025-01-08', 2), // Wednesday W02
      snap('2025-01-13', 3), // Monday W03
    ]
    const weekly = bucketHistoryByGranularity(history, 'weekly')
    expect(weekly).toEqual([snap('2025-01-08', 2), snap('2025-01-13', 3)])
  })
})

describe('getHistorySpanDays', () => {
  it('returns 0 for fewer than 2 points', () => {
    expect(getHistorySpanDays([])).toBe(0)
    expect(getHistorySpanDays([snap('2025-01-01')])).toBe(0)
  })

  it('computes the span even when input is unsorted', () => {
    expect(
      getHistorySpanDays([snap('2025-01-31'), snap('2025-01-01'), snap('2025-01-15')]),
    ).toBe(30)
  })
})
