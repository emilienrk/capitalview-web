/**
 * Prints a reading's value and its band ceilings in the format the API names.
 *
 * Basis points are shown as a percentage: "20 bps" is a unit most readers have
 * to look up, "0,20 %" is not.
 */
import { useDisplayLocale } from '@/composables/useDisplayLocale'
import type { ReadingFormat } from '@/types'

type NumericValue = number | string | null | undefined

export function useReadingFormat(): {
  formatReading: (value: NumericValue, format: ReadingFormat, compact?: boolean) => string
} {
  const { effectiveLocale } = useDisplayLocale()

  function fixed(n: number, digits: number, compact: boolean): string {
    return new Intl.NumberFormat(effectiveLocale.value, {
      minimumFractionDigits: compact ? 0 : digits,
      maximumFractionDigits: digits,
    }).format(n)
  }

  /** `compact` drops trailing zeros: a ceiling reads "80 %", a value "93,0 %". */
  function formatReading(value: NumericValue, format: ReadingFormat, compact = false): string {
    if (value === null || value === undefined || value === '') return '—'
    const n = Number(value)
    if (!Number.isFinite(n)) return '—'
    switch (format) {
      case 'pct':
        return `${fixed(n * 100, 1, compact)} %`
      case 'days':
        return `${Math.round(n)} j`
      case 'bps':
        return `${fixed(n / 100, 2, compact)} %`
      case 'times':
        return `${fixed(n, 1, compact)}×`
      default:
        return fixed(n, 1, compact)
    }
  }

  return { formatReading }
}
