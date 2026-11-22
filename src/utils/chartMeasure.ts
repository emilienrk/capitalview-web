export interface MeasureSpan {
  fromIndex: number
  toIndex: number
  fromValue: number
  toValue: number
  diff: number
  /** Null when the starting value is too close to zero for a ratio to mean anything. */
  percent: number | null
}

/** Nearest index holding a value, searched outwards and kept inside [min, max]. */
export function nearestDefinedIndex(
  values: ReadonlyArray<number | null | undefined>,
  index: number,
  min = 0,
  max = values.length - 1,
): number | null {
  const lo = Math.max(0, min)
  const hi = Math.min(values.length - 1, max)
  if (hi < lo) return null
  const start = Math.min(hi, Math.max(lo, Math.round(index)))
  for (let offset = 0; start - offset >= lo || start + offset <= hi; offset++) {
    const before = start - offset
    if (before >= lo && values[before] != null) return before
    const after = start + offset
    if (after <= hi && values[after] != null) return after
  }
  return null
}

/**
 * Change between two points of a series, always read forward in time: whichever
 * end the gesture started from, the earlier date is the base.
 *
 * `minBase` mirrors the guard of each chart's header badge: a cumulative P/L
 * starting near 0 € would give an exploding ratio, while a price below 1 € is
 * a perfectly good base.
 */
export function measureSpan(
  values: ReadonlyArray<number | null | undefined>,
  a: number,
  b: number,
  minBase = 1,
): MeasureSpan | null {
  const fromIndex = Math.min(a, b)
  const toIndex = Math.max(a, b)
  const fromValue = values[fromIndex]
  const toValue = values[toIndex]
  if (fromValue == null || toValue == null) return null

  const diff = toValue - fromValue
  const base = Math.abs(fromValue)
  const percent = base > 0 && base >= minBase ? (diff / base) * 100 : null
  return { fromIndex, toIndex, fromValue, toValue, diff, percent }
}
