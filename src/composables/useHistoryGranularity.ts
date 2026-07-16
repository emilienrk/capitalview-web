import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'

/**
 * Shared history-granularity logic (daily/weekly/monthly/yearly bucketing)
 * previously copy-pasted across Crypto, Stock, Dashboard and Bank pages.
 */

export type HistoryGranularity = 'daily' | 'weekly' | 'monthly' | 'yearly'

export interface GranularityOption {
  value: HistoryGranularity
  label: string
}

interface DatedSnapshot {
  snapshot_date: string
}

export const ALL_GRANULARITY_OPTIONS: GranularityOption[] = [
  { value: 'daily', label: 'Jour' },
  { value: 'weekly', label: 'Semaine' },
  { value: 'monthly', label: 'Mois' },
  { value: 'yearly', label: 'Année' },
]

export function getIsoWeekKey(snapshotDate: string): string {
  const date = new Date(snapshotDate)
  if (Number.isNaN(date.getTime())) return snapshotDate

  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const weekday = utcDate.getUTCDay() || 7
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - weekday)

  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1))
  const weekNumber = Math.ceil((((utcDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${utcDate.getUTCFullYear()}-W${String(weekNumber).padStart(2, '0')}`
}

export function getHistoryBucketKey(snapshotDate: string, granularity: HistoryGranularity): string {
  const date = new Date(snapshotDate)
  if (Number.isNaN(date.getTime())) return snapshotDate

  if (granularity === 'weekly') return getIsoWeekKey(snapshotDate)
  if (granularity === 'monthly') return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  if (granularity === 'yearly') return String(date.getFullYear())
  return snapshotDate
}

function sortBySnapshotDate<T extends DatedSnapshot>(history: T[]): T[] {
  return [...history].sort(
    (a, b) => new Date(a.snapshot_date).getTime() - new Date(b.snapshot_date).getTime(),
  )
}

/**
 * Keep the latest point of each period (end-of-week/month/year value).
 * Sorts internally so the result is correct regardless of input order.
 */
export function bucketHistoryByGranularity<T extends DatedSnapshot>(
  history: T[],
  granularity: HistoryGranularity,
): T[] {
  if (granularity === 'daily') return history

  const byBucket = new Map<string, T>()
  for (const snapshot of sortBySnapshotDate(history)) {
    byBucket.set(getHistoryBucketKey(snapshot.snapshot_date, granularity), snapshot)
  }

  return Array.from(byBucket.values())
}

/** Number of days between the earliest and latest snapshot (0 if < 2 points). */
export function getHistorySpanDays(history: DatedSnapshot[]): number {
  if (history.length < 2) return 0

  let first = Number.POSITIVE_INFINITY
  let last = Number.NEGATIVE_INFINITY
  for (const snapshot of history) {
    const time = new Date(snapshot.snapshot_date).getTime()
    if (!Number.isFinite(time)) continue
    if (time < first) first = time
    if (time > last) last = time
  }

  if (!Number.isFinite(first) || !Number.isFinite(last) || last <= first) return 0
  return Math.floor((last - first) / 86400000)
}

export interface UseHistoryGranularityReturn {
  granularity: Ref<HistoryGranularity>
  granularityOptions: ComputedRef<GranularityOption[]>
  applyGranularity: <T extends DatedSnapshot>(history: T[]) => T[]
}

/**
 * Reactive granularity selector: exposes the selected granularity, the
 * options allowed for the current history span (weekly needs ≥ 21 days,
 * monthly ≥ 90, yearly ≥ 365) and a bucketing helper. Auto-clamps the
 * selection when the allowed options shrink.
 */
export function useHistoryGranularity(
  historySource: () => DatedSnapshot[],
): UseHistoryGranularityReturn {
  const granularity = ref<HistoryGranularity>('daily')

  const granularityOptions = computed<GranularityOption[]>(() => {
    const spanDays = getHistorySpanDays(historySource())
    return ALL_GRANULARITY_OPTIONS.filter((option) => {
      if (option.value === 'daily') return true
      if (option.value === 'weekly') return spanDays >= 21
      if (option.value === 'monthly') return spanDays >= 90
      return spanDays >= 365
    })
  })

  watch(granularityOptions, (options) => {
    const allowed = options.map((option) => option.value)
    if (!allowed.includes(granularity.value)) {
      granularity.value = options[0]?.value ?? 'daily'
    }
  }, { immediate: true })

  function applyGranularity<T extends DatedSnapshot>(history: T[]): T[] {
    return bucketHistoryByGranularity(history, granularity.value)
  }

  return { granularity, granularityOptions, applyGranularity }
}
